import {afterEach, it, expect, vi} from "vitest";
import {render, screen, fireEvent, cleanup, waitFor} from "@testing-library/react";
import FeatureSettings, {featureHostMatches} from "./FeatureSettings";
import {Sites} from "./MemberApp";
import {clearCsrf} from "./api";
afterEach(() => {cleanup(); clearCsrf(); vi.unstubAllGlobals();});
it("explicit default, nondefault and malformed ports follow the Server rejection contract", () => {
  for (const [host, code] of [["youtube.com", "YOUTUBE_COMMENTS"], ["instagram.com", "INSTAGRAM_REELS"]]) {
    for (const value of [host, `https://${host}/watch?v=1:2`, `http://${host}/path:443`, `https://${host.toUpperCase()}./`])
      expect(featureHostMatches(value, code), value).toBe(true);
    for (const value of [`https://${host}:443/`, `http://${host}:80/`, `${host}:443`, `${host}:80`,
      `https://${host}:0443/`, `https://${host}:8080/`, `https://${host}:0/`,
      `https://${host}:65535/`, `https://${host}:65536/`, `https://${host}:/`,
      `https://${host}:abc/`, `https://${host}:-1/`, `https://${host}:443:80/`])
      expect(featureHostMatches(value, code), value).toBe(false);
  }
  render(<FeatureSettings url="https://youtube.com:443/" values={{}} busy={false} blocked={false} onChange={vi.fn()}/>);
  expect(screen.getAllByRole("checkbox").every(c => (c as HTMLInputElement).disabled)).toBe(true);
});
it("host boundary, ports and unsupported hosts never enable incompatible toggles", () => {
  for (const host of ["youtube.com", "www.youtube.com", "https://m.youtube.com/path"])
    expect(featureHostMatches(host,"YOUTUBE_COMMENTS")).toBe(true);
  for (const host of ["notyoutube.com", "youtube.com.evil.org", "instagram.com", "youtube.com:8080", "https://user:pass@youtube.com"])
    expect(featureHostMatches(host,"YOUTUBE_COMMENTS")).toBe(false);
  render(<FeatureSettings url="instagram.com" values={{}} busy={false} blocked={true} onChange={vi.fn()}/>);
  expect(screen.getByRole("checkbox",{name:/YouTube 댓글/})).toBeDisabled();
  expect(screen.getByRole("checkbox",{name:/Instagram Reels/})).toBeEnabled();
  expect(screen.getByText(/전체 차단 정책이/)).toBeInTheDocument();
});
it("loaded flags survive editing and 412; retry uses the latest version without replacing input", async () => {
  const site={site_id:"1",canonical_host:"youtube.com",display_name:"saved",include_subdomains:true,purpose:"GENERAL",access_policy:"ALLOW",version:1,
    feature_policies:[{feature_code:"YOUTUBE_SHORTS",enabled:true},{feature_code:"YOUTUBE_COMMENTS",enabled:true},{feature_code:"YOUTUBE_AUTOPLAY",enabled:false}]};
  const writes:RequestInit[]=[];
  vi.stubGlobal("fetch",vi.fn(async (url:string, options:RequestInit={}) => {
    if(url.endsWith("/csrf")) return new Response(JSON.stringify({csrf_token:"synthetic"}));
    if(options.method === "PATCH") {
      writes.push(options);
      return writes.length===1 ? new Response(JSON.stringify({error:{code:"VERSION_CONFLICT"}}),{status:412}) : new Response(JSON.stringify({...site,version:3}));
    }
    if(url.endsWith("/sites/1")) return new Response(JSON.stringify({...site,display_name:"server latest",version:2}));
    return new Response(JSON.stringify({items:[site],next_cursor:null,has_more:false}));
  }));
  render(<Sites/>);
  fireEvent.click(await screen.findByRole("button",{name:"수정"}));
  expect(screen.getByRole("checkbox",{name:/YouTube 댓글/})).toBeChecked();
  expect(screen.getByRole("checkbox",{name:/YouTube 자동재생/})).not.toBeChecked();
  fireEvent.change(screen.getByLabelText(/사이트 이름/),{target:{value:"my edit"}});
  fireEvent.click(screen.getByRole("button",{name:"저장"}));
  await screen.findByText("서버 최신 값");
  expect(screen.getByLabelText(/사이트 이름/)).toHaveValue("my edit");
  expect(screen.getByRole("checkbox",{name:/YouTube 댓글/})).toBeChecked();
  fireEvent.click(screen.getByRole("button",{name:"최신 버전 기준으로 편집값 다시 저장 준비"}));
  fireEvent.click(screen.getByRole("button",{name:"저장"}));
  await waitFor(()=>expect(writes).toHaveLength(2));
  expect(new Headers(writes[0].headers).get("If-Match")).toBe('"1"');
  expect(new Headers(writes[1].headers).get("If-Match")).toBe('"2"');
  expect(JSON.parse(writes[1].body as string)).toMatchObject({display_name:"my edit",feature_policies:site.feature_policies});
});
it("saved setting is not shown as execution success and busy blocks clicks", () => {
  render(<FeatureSettings url="youtube.com" values={{YOUTUBE_COMMENTS:true}} busy={true} blocked={false} onChange={vi.fn()}/>);
  expect(screen.getByRole("status")).toHaveTextContent("집중 시작은 제한");
  expect(screen.getByRole("checkbox",{name:/YouTube 댓글/})).toBeChecked();
  expect(screen.getAllByRole("checkbox").every(c => (c as HTMLInputElement).disabled)).toBe(true);
});
it("site save rejection preserves multiple flags, input and manual retry idempotency", async () => {
  let writes: RequestInit[]=[];
  vi.stubGlobal("fetch",vi.fn(async (url:string, options:RequestInit={}) => {
    if(url.endsWith("/csrf")) return new Response(JSON.stringify({csrf_token:"synthetic"}));
    if(options.method === "POST") {
      writes.push(options);
      if(writes.length===1) return new Response(JSON.stringify({error:{code:"VALIDATION_FAILED"}}),{status:422});
      return new Response(JSON.stringify({site_id:"1"}),{status:201});
    }
    return new Response(JSON.stringify({items:[],next_cursor:null,has_more:false}));
  }));
  render(<Sites/>);
  await screen.findByText("등록된 사이트가 없습니다.");
  fireEvent.change(screen.getByLabelText(/URL 또는 도메인/),{target:{value:"youtube.com"}});
  fireEvent.change(screen.getByLabelText(/사이트 이름/),{target:{value:"test"}});
  fireEvent.click(screen.getByRole("checkbox",{name:/YouTube 댓글/}));
  fireEvent.click(screen.getByRole("checkbox",{name:/YouTube 자동재생/}));
  fireEvent.click(screen.getByRole("button",{name:"저장"}));
  await waitFor(()=>expect(writes).toHaveLength(1));
  await waitFor(()=>expect(screen.getByRole("button",{name:"저장"})).toBeEnabled());
  expect(screen.getByLabelText(/사이트 이름/)).toHaveValue("test");
  fireEvent.click(screen.getByRole("button",{name:"저장"}));
  await waitFor(()=>expect(writes).toHaveLength(2));
  expect(writes[1].body).toEqual(writes[0].body);
  expect(new Headers(writes[1].headers).get("Idempotency-Key")).toEqual(new Headers(writes[0].headers).get("Idempotency-Key"));
  expect(JSON.parse(writes[0].body as string).feature_policies).toEqual([
    {feature_code:"YOUTUBE_COMMENTS",enabled:true}, {feature_code:"YOUTUBE_AUTOPLAY",enabled:true}]);
});
