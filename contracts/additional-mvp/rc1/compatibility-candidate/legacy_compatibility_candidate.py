"""Isolated RC2 compatibility proposal. NOT installed into any contract checker.
Never writes a source checkout, lock, index, or approved hash. No operational authority.
"""
import ast
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path

POLICY_SHA256 = "95602b5ac475362c02146fa1b77a1d95f231167a88af158c7b6b7e82a5a60f2a"
HISTORICAL_ORDER = ("55", "70", "59", "68", "103")
PROFILE_ORDER = {
    "integration-proposal": HISTORICAL_ORDER,
    "integration107-checkout-proposal": HISTORICAL_ORDER + ("107",),
    "integration108-checkout-proposal": HISTORICAL_ORDER + ("107",),
    "gate-review-only": HISTORICAL_ORDER + ("gate-bundles",),
    "snapshot-review-only": HISTORICAL_ORDER + ("gate-bundles", "snapshot-bundles"),
}
LOCK_PATH = "contracts/additional-mvp/rc1/legacy-lock.json"
NODE_BUILDER = r"""import fs from 'node:fs';import {createHash} from 'node:crypto';
import {buildA0} from './extension/scripts/build-a0.mjs';
import {buildA1} from './extension/scripts/build-a1.mjs';
import {buildMemberA1} from './extension/scripts/build-member-a1.mjs';
const a=buildA0(),b=buildA1(),c=buildMemberA1();
const values={'extension/a0/content.bundle.js':a.content,'extension/a1/content.bundle.js':b.content,'extension/background/a1-core.bundle.js':b.core,'extension/member-a1/content.bundle.js':c.content,'extension/background/member-a1-core.bundle.js':c.core};
console.log(JSON.stringify(Object.fromEntries(Object.entries(values).map(([p,s])=>[p,createHash('sha256').update(s).digest('hex')]))));"""

class Rejected(ValueError):
    pass

def need(ok, code):
    if not ok:
        raise Rejected(code)

def digest(value):
    return hashlib.sha256(value).hexdigest()

def lf(value):
    need(type(value) is bytes, "SOURCE_BYTES_REQUIRED")
    return value.replace(b"\r\n", b"\n")

def reverse_unified(current, patch):
    """Strict inverse at declared new-line offsets: no fuzzy search, offsets, or retries."""
    lines = current.splitlines(keepends=True)
    chunks = patch.splitlines(keepends=True)
    hunks = []
    i = 0
    while i < len(chunks):
        line = chunks[i]
        if line.startswith((b"--- ", b"+++ ")):
            need(not hunks, "PATCH_HEADER_ORDER")
            i += 1
            continue
        match = re.fullmatch(rb"@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@[^\n]*\n", line)
        need(match is not None, "PATCH_FORMAT")
        old_start, old_count, new_start, new_count = (
            int(match[1]), int(match[2] or b"1"), int(match[3]), int(match[4] or b"1")
        )
        old, new = [], []
        i += 1
        last_prefix = None
        while i < len(chunks) and not chunks[i].startswith(b"@@ "):
            item = chunks[i]
            if item.startswith(b"\\ No newline at end of file"):
                need(last_prefix is not None, "PATCH_NEWLINE_MARKER")
                if last_prefix in (b" ", b"-"):
                    old[-1] = old[-1].removesuffix(b"\n")
                if last_prefix in (b" ", b"+"):
                    new[-1] = new[-1].removesuffix(b"\n")
            else:
                prefix = item[:1]
                need(prefix in (b" ", b"+", b"-"), "PATCH_LINE_FORMAT")
                if prefix in (b" ", b"-"):
                    old.append(item[1:])
                if prefix in (b" ", b"+"):
                    new.append(item[1:])
                last_prefix = prefix
            i += 1
        need(len(old) == old_count and len(new) == new_count, "PATCH_COUNT")
        pos = new_start if new_count == 0 else new_start - 1
        need(pos >= 0, "PATCH_OFFSET")
        hunks.append((pos, new, old))
    need(bool(hunks), "EMPTY_PATCH")
    for pos, expected, restored in reversed(hunks):
        need(lines[pos:pos + len(expected)] == expected, "PATCH_CONTEXT_OR_PARTIAL_MISMATCH")
        lines[pos:pos + len(expected)] = restored
    return b"".join(lines)

class CandidateVerifier:
    def __init__(self, package=None):
        # Optional package is for independent integrity testing / portable review ZIP only.
        self.package = Path(package) if package else Path(__file__).resolve().parent
        raw = (self.package / "policy.json").read_bytes()
        need(digest(raw) == POLICY_SHA256, "POLICY_PIN_MISMATCH")
        self.policy = json.loads(raw)
        self.assets = {}
        for path, expected in self.policy["assets"].items():
            need(path.startswith("blobs/") and re.fullmatch(r"blobs/[a-f0-9]{64}", path), "ASSET_PATH")
            value = (self.package / "assets" / path).read_bytes()
            need(digest(value) == expected, "ASSET_PIN_MISMATCH")
            self.assets[path] = value
        need(tuple(self.policy["historicalOrder"]) == HISTORICAL_ORDER, "PATCH_ORDER")
        for name, profile in self.policy["profiles"].items():
            need(tuple(profile["transitionIds"]) == PROFILE_ORDER[name], "PATCH_ORDER")
        self.lock_bytes = self.assets[self.policy["legacyLockAsset"]]
        self.lock = json.loads(self.lock_bytes)
        owner = ast.parse(self.assets[self.policy["ownerValidatorAsset"]])
        nodes = [n for n in owner.body if (
            isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "CREATE_ADDITIONS" for t in n.targets)
        ) or (isinstance(n, ast.FunctionDef) and n.name == "legacy_bytes_preserved")]
        need(len(nodes) == 2, "ORIGINAL_VALIDATOR_MISSING")
        namespace = {"hashlib": hashlib}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "pinned-original-validator", "exec"), namespace)
        self.original = namespace["legacy_bytes_preserved"]

    def profile(self, name, commit):
        need(name in PROFILE_ORDER, "EXPLICIT_REVIEW_SCOPE_REQUIRED")
        p = self.policy["profiles"][name]
        need(commit == p["sourceCommit"], "EXACT_SOURCE_REVISION_REQUIRED")
        return p

    def required_paths(self, profile):
        return set(self.lock["files"]) | set(profile["buildInputs"]) | set(profile["bundleOutputs"]) | {LOCK_PATH}

    def verify_snapshot(self, files, *, commit, profile):
        """Pure isolated test seam. Commit context must be supplied by a trusted Git-object reader.
        This seam is NOT authentication or an adapter for a mutable product checkout.
        """
        p = self.profile(profile, commit)
        need(set(files) == self.required_paths(p), "OUT_OF_SCOPE_OR_MISSING_INPUT")
        values = {path: lf(data) for path, data in files.items()}
        need(values[LOCK_PATH] == self.lock_bytes, "ORIGINAL_LOCK_CHANGED")
        transitions = {t["id"]: t for t in self.policy["transitions"]}
        restored = {}
        for path, expected in self.lock["files"].items():
            value = values[path]
            if path in self.policy["integrationPaths"]:
                selected = [transitions[t]["files"][path] for t in p["transitionIds"] if path in transitions[t]["files"]]
                need(bool(selected), "MISSING_APPROVED_PATCH")
                for step in reversed(selected):
                    need(digest(value) == step["afterSHA256"], "UNAPPROVED_OR_PARTIAL_PRODUCT_DIFF")
                    value = reverse_unified(value, self.assets[step["patchAsset"]])
                    need(value == self.assets[step["beforeAsset"]] and digest(value) == step["beforeSHA256"], "INVERSE_NOT_EXACT")
                need(value == self.assets[self.policy["baseline"][path]], "ORIGINAL_BYTES_NOT_RESTORED")
                need(digest(value) == expected, "ORIGINAL_PROTECTED_HASH_MISMATCH")
                restored[path] = digest(value)
            else:
                need(self.original(path, value, expected), "PROTECTED_OUT_OF_SCOPE_CHANGE")
        # Pin ALL actual builder reads, not only the previously protected bundle bytes.
        for path, spec in p["buildInputs"].items():
            need(digest(values[path]) == spec["sha256"], "UNAPPROVED_BUILD_INPUT")
        # Rebuild only a frozen copy of verified inputs. Never execute mutable checkout code.
        with tempfile.TemporaryDirectory(prefix="focurve-compat-build-") as temporary:
            root = Path(temporary)
            for path in p["buildInputs"]:
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(values[path])
            try:
                run = subprocess.run(["node", "--input-type=module", "-e", NODE_BUILDER], cwd=root,
                                     capture_output=True, check=True, timeout=20)
                actual = json.loads(run.stdout)
            except (subprocess.SubprocessError, ValueError, OSError) as error:
                raise Rejected("BUNDLE_REBUILD_UNCONFIRMED") from error
        need(actual == p["bundleOutputs"], "APPROVED_GENERATOR_OUTPUT_MISMATCH")
        for path, generated in actual.items():
            need(digest(values[path]) == generated, "STALE_OR_TAMPERED_BUNDLE")
        return {"candidateVerification": "PASS", "profile": profile, "commit": commit,
                "scopeStatus": p["scopeStatus"], "restoredOriginalFiles": len(restored),
                "protectedFiles": len(self.lock["files"]), "verifiedBuildInputs": len(p["buildInputs"]),
                "reproducedBundles": len(actual), "operationalExceptionApplied": False,
                "productAcceptance": "NOT_RUN", "approval": "NOT_GRANTED"}

    def verify_repo(self, repository, *, commit, profile):
        p = self.profile(profile, commit)
        repository = Path(repository)
        def git(*args):
            return subprocess.check_output(["git", "-c", "core.longpaths=true", *args], cwd=repository, stderr=subprocess.PIPE)
        try:
            actual = git("rev-parse", commit + "^{tree}").decode().strip()
            need(actual == p["sourceTree"], "EXACT_SOURCE_TREE_REQUIRED")
            for transition in self.policy["transitions"]:
                if transition["id"] not in p["transitionIds"] or transition["kind"] != "MERGED_PRODUCT_REVIEWED_NOT_EXCEPTION_APPROVED":
                    continue
                parents = [line.split()[1] for line in git("cat-file", "-p", transition["afterCommit"]).decode().splitlines() if line.startswith("parent ")]
                need(parents == transition["integrationMergeParents"] and parents[1] == transition["reviewedProductHead"], "APPROVED_COMMIT_ANCESTRY_MISMATCH")
            values = {path: git("show", commit + ":" + path) for path in sorted(self.required_paths(p))}
        except subprocess.CalledProcessError as error:
            raise Rejected("GIT_SOURCE_UNCONFIRMED") from error
        # Immutable Git objects only; working tree and shared index are never consulted or written.
        return self.verify_snapshot(values, commit=commit, profile=profile)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Review-only RC2 compatibility proposal (no activation)")
    parser.add_argument("--repo", required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--profile", required=True, choices=PROFILE_ORDER)
    args = parser.parse_args()
    print(json.dumps(CandidateVerifier().verify_repo(args.repo, commit=args.commit, profile=args.profile), indent=2))
