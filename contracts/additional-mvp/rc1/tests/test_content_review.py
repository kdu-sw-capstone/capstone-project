"""Content review counterexamples and protocol-only effects. No DOM/Chrome is run."""
import copy
import json
import unittest
from pathlib import Path
import reference_model as legacy
from test_core_review import valid
try:
    from review_reference import ContentOperationRegistry
except ImportError:
    ContentOperationRegistry=None

P=Path(__file__).resolve().parents[1]
def fixtures():
    path=P/'content-review-fixtures.json'
    if path.exists():return json.loads(path.read_text('utf8'))
    wire=json.loads((P/'wire-fixtures.json').read_text('utf8'))['messages']
    # Before RC2: use the actual reviewed RC1 message/effect examples.
    c=copy.deepcopy(wire[0]['value']);r=copy.deepcopy(wire[1]['value'])
    blur=copy.deepcopy(r);blur['effects']=[{'kind':'CONTENT_POLICY','policy_type':'BLUR','result':'APPLIED'}]
    keyword=copy.deepcopy(r);keyword['effects']=[{'kind':'CONTENT_POLICY','policy_type':'KEYWORD','result':'APPLIED'}]
    return {'media':{'control':c,'result':r},'blur':{'control':c,'result':blur},'keyword':{'control':c,'result':keyword}}
def verify(result,control,prior=None,footprint=None):
    if ContentOperationRegistry:
        registry=ContentOperationRegistry();registry.issue(control,prior_claims=prior,prior_footprint_sha256=footprint)
        return registry.validate(result)
    return legacy.validate_semantics('ContentResult',result)

class ContentCounterexamples(unittest.TestCase):
    def test_media_stop_false_is_not_applied(self):
        f=copy.deepcopy(fixtures()['media']);f['result']['effects'][0]['media_stopped']=False
        with self.assertRaises(ValueError):verify(f['result'],f['control'])
    def test_zero_viewer_media_is_not_applied(self):
        f=copy.deepcopy(fixtures()['media']);e=f['result']['effects'][0]
        e.update(eligible_target_count=0,restricted_target_count=0,media_stopped=None)
        if 'media' in e:e['media'].update(viewer_count=0,target_count=0,stopped_count=0,hidden_count=0,inert_count=0)
        with self.assertRaises(ValueError):verify(f['result'],f['control'])
    def test_required_option_missing_is_rejected(self):
        f=copy.deepcopy(fixtures()['media']);f['control']['payload']['projection']['features'].append({'feature_id':'YT-03','enabled':True,'required':True})
        if ContentOperationRegistry:
            content=f['control']['payload']['projection']['content']
            if content is not None:content['features']=copy.deepcopy(f['control']['payload']['projection']['features'])
            f['control']['payload']['semantic_sha256']=legacy.digest(f['control']['payload'],('semantic_sha256','channel_credential'))
            f['result']['semantic_sha256']=f['control']['payload']['semantic_sha256']
        with self.assertRaises(ValueError):verify(f['result'],f['control'])
    def test_duplicate_feature_result_is_rejected(self):
        f=copy.deepcopy(fixtures()['media']);f['result']['effects'].append(copy.deepcopy(f['result']['effects'][0]))
        with self.assertRaises(ValueError):verify(f['result'],f['control'])
    def test_unrequested_feature_result_is_rejected(self):
        f=copy.deepcopy(fixtures()['media']);f['result']['effects'][0]['feature_id']='YT-03'
        with self.assertRaises(ValueError):verify(f['result'],f['control'])
    def test_blur_only_has_distinct_result_schema(self):
        f=fixtures()['blur'];self.assertTrue(valid('ContentResult',f['result']))
        self.assertEqual(verify(f['result'],f['control']),'APPLIED')

    def test_keyword_only_has_distinct_result_schema(self):
        f=fixtures()['keyword'];self.assertTrue(valid('ContentResult',f['result']))
        self.assertEqual(verify(f['result'],f['control']),'APPLIED')

class ContentBoundaryTests(unittest.TestCase):
    def f(self,name='media'):return copy.deepcopy(fixtures()[name])
    def run_case(self,f):return verify(f['result'],f['control'],f.get('prior_claims'),f.get('prior_footprint_sha256'))
    def reseal(self,f):
        f['control']['payload']['semantic_sha256']=legacy.digest(f['control']['payload'],('semantic_sha256','channel_credential'))
        f['result']['semantic_sha256']=f['control']['payload']['semantic_sha256']
    def test_all_standalone_mixed_and_cleanup_fixtures(self):
        for name,f in fixtures().items():
            if name=='notice':continue
            with self.subTest(case=name):
                self.assertTrue(valid('Control',f['control']));self.assertTrue(valid('ContentResult',f['result']))
                self.assertEqual(self.run_case(f),'RELEASED' if name.endswith('_release') else 'APPLIED')
    def test_viewer_media_count_stop_and_audio_boundaries(self):
        for changes in [{'viewer_count':0},{'target_count':0},{'stopped_count':0},{'hidden_count':0},{'inert_count':0},{'playing_count':1},{'stop_error_count':1},{'audio_verification':'PASS'}]:
            f=self.f();f['result']['effects'][0]['media'].update(changes)
            with self.subTest(changes=changes),self.assertRaises(ValueError):self.run_case(f)
    def test_zero_direct_viewer_is_observing_not_applied(self):
        f=self.f();e=f['result']['effects'][0]
        e.update(result='OBSERVING',eligible_target_count=0,restricted_target_count=0,media_stopped=None)
        e['media'].update(viewer_count=0,target_count=0,stopped_count=0,hidden_count=0,inert_count=0)
        f['result']['result_state']='OBSERVING';self.assertEqual(self.run_case(f),'OBSERVING')
        e['result']='NOT_APPLICABLE';f['result']['result_state']='NOT_APPLICABLE'
        with self.assertRaises(ValueError):self.run_case(f)
    def test_nonviewer_zero_targets_requires_scan_and_observer(self):
        f=self.f();ctx=f['control']['payload']['projection']['document_context'];ctx.update(route_kind='ENTRY_SURFACE',viewer_feature_id=None)
        e=f['result']['effects'][0];e.update(result='NOT_APPLICABLE',presentation='ENTRY_SURFACE',eligible_target_count=0,restricted_target_count=0,media=None,media_stopped=None)
        f['result']['result_state']='NOT_APPLICABLE';self.reseal(f);self.assertEqual(self.run_case(f),'NOT_APPLICABLE')
        for field in ['scan_complete','observer_ready']:
            bad=copy.deepcopy(f);bad['result']['effects'][0][field]=False
            with self.assertRaises(ValueError):self.run_case(bad)
    def test_projection_mirror_and_duplicate_requests_rejected(self):
        f=self.f();content=copy.deepcopy(json.loads((P/'examples.json').read_text('utf8'))['definitions']['ContentConfig'])
        f['control']['payload']['projection']['content']=content;self.reseal(f)
        with self.assertRaisesRegex(ValueError,'FEATURE_MIRROR_CONFLICT'):self.run_case(f)
        f=self.f();f['control']['payload']['projection']['features'].append({'feature_id':'YT-02','enabled':False,'required':True});self.reseal(f)
        with self.assertRaisesRegex(ValueError,'DUPLICATE_REQUEST_FEATURE'):self.run_case(f)
    def test_results_bind_request_operation_scope_owner_scan_and_hash(self):
        for field,newvalue in [('request_id','00000000-0000-4000-8000-000000000999'),('operation_id','00000000-0000-4000-8000-000000000998'),('semantic_sha256','1'*64)]:
            f=self.f();f['result'][field]=newvalue
            with self.assertRaises(ValueError):self.run_case(f)
        for change in [{'owner_binding_id':'00000000-0000-4000-8000-000000000999'},{'evidence_scope_sha256':'1'*64},{'scan_id':'00000000-0000-4000-8000-000000000997'}]:
            f=self.f('blur');f['result']['effects'][0].update(change)
            with self.assertRaises(ValueError):self.run_case(f)
    def test_issuer_lookup_is_mandatory_and_retry_is_semantic(self):
        f=self.f()
        with self.assertRaisesRegex(ValueError,'MISSING_ISSUED_OPERATION'):ContentOperationRegistry().validate(f['result'])
        with self.assertRaisesRegex(ValueError,'MISSING_ISSUED_OPERATION'):legacy.validate_semantics('ContentResult',f['result'])
        r=ContentOperationRegistry();r.issue(f['control']);retry=copy.deepcopy(f['control']);retry['request_id']='00000000-0000-4000-8000-000000000998';retry['payload']['channel_credential']='1'*64
        r.issue(retry);out=copy.deepcopy(f['result']);out['request_id']=retry['request_id'];self.assertEqual(r.validate(out),'APPLIED')
    def test_blur_failure_mask_is_not_full_applied(self):
        f=self.f('blur');e=f['result']['effects'][0];e.update(result='FAILED',error_count=1)
        e['details'].update(classified_image_count=0,failed_image_count=1,fail_safe_masked_count=1)
        f['result'].update(result_state='FAILED',status='NACK',error_code='MODEL_FAILED_MASK_RETAINED')
        self.assertEqual(self.run_case(f),'FAILED');self.assertEqual(f['result']['remaining_claim_count'],1)
        e['result']='APPLIED';e['error_count']=0;f['result'].update(result_state='APPLIED',status='ACK',error_code=None)
        with self.assertRaises(ValueError):self.run_case(f)
    def test_blur_profile_stale_generation_mask_and_reveal(self):
        for changes in [{'profile_sha256':'1'*64},{'stale_results_applied_count':1},{'masked_image_count':0}]:
            f=self.f('blur');f['result']['effects'][0]['details'].update(changes)
            with self.assertRaises(ValueError):self.run_case(f)
        f=self.f('blur');d=f['result']['effects'][0]['details'];d.update(masked_image_count=0,revealed_image_count=1,reveal_intent_sha256='2'*64)
        self.assertEqual(self.run_case(f),'APPLIED');d['reveal_intent_sha256']=None
        with self.assertRaises(ValueError):self.run_case(f)
    def test_keyword_scope_gate_and_no_raw_url_payload(self):
        self.assertEqual(self.run_case(self.f('keyword_gate')),'APPLIED')
        for changes in [{'checked_url_sha256':'1'*64},{'url_check_result':'UNVERIFIABLE'},{'url_check_result':'MATCH'},{'raw_url':'https://private.example.test/'}]:
            f=self.f('keyword');f['result']['effects'][0]['details'].update(changes)
            with self.assertRaises(ValueError):self.run_case(f)
    def test_mixed_partial_is_not_whole_applied(self):
        f=self.f('mixed');f['result']['effects'][0].update(result='FAILED',error_count=1)
        f['result'].update(result_state='PARTIAL',status='NACK',error_code='BLUR_FAILED_KEYWORD_APPLIED')
        self.assertEqual(self.run_case(f),'PARTIAL')
        f['result'].update(result_state='APPLIED',status='ACK',error_code=None)
        with self.assertRaises(ValueError):self.run_case(f)
    def test_policy_release_requires_full_owned_restore_and_single_cleanup_lane(self):
        for name in ['blur_release','keyword_release','mixed_release']:
            f=self.f(name);self.assertIsNone(f['control']['payload']['control_seq']);self.assertEqual(self.run_case(f),'RELEASED')
            bad=copy.deepcopy(f);bad['result']['effects'][0]['restore']['other_owner_claims_preserved']=False
            with self.assertRaises(ValueError):self.run_case(bad)
            bad=copy.deepcopy(f);bad['result']['effects'][0]['policy_sha256']='1'*64
            with self.assertRaises(ValueError):self.run_case(bad)
    def test_content_result_does_not_claim_core_dnr(self):
        f=self.f('adult');f['result']['effects'][0]['details']['dnr_effect_claimed']=True
        with self.assertRaises(ValueError):self.run_case(f)
    def test_missing_policy_and_restore_media_are_not_success(self):
        f=self.f('mixed');f['result']['effects'].pop()
        with self.assertRaisesRegex(ValueError,'MISSING_OR_UNREQUESTED_EFFECT_RESULT'):self.run_case(f)
        messages=json.loads((P/'wire-fixtures.json').read_text('utf8'))['messages']
        for field,value in [('media_restore_state','UNCONFIRMED'),('playback_restart','FORCED'),('audio_verification','PASS')]:
            row=copy.deepcopy(messages[3]);row['value']['effects'][0]['restore'][field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):
                verify(row['value'],messages[row['issued_control_index']]['value'],row['prior_claims'],row['prior_footprint_sha256'])

if __name__=='__main__':unittest.main()
