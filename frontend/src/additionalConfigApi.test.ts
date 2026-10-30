import {beforeEach,expect,it,vi} from "vitest";
import {request} from "./api";
import {listConfigs,readConfig,configWrite,configDelete,type ConfigRecord,type ConfigValue} from "./additionalConfigApi";
vi.mock("./api",()=>({request:vi.fn(),UiError:class extends Error{}}));
const executor="00000000-0000-4000-8000-000000000001",id="00000000-0000-4000-8000-000000000002";
const value:ConfigValue={kind:"CADENCE",enabled:false,focus_minutes:25,rest_minutes:5,cycles:4,auto_start_next:false,rest_clock:"ELAPSED_WALL_CLOCK",missed_focus:"WAIT_USER",deadline_at:null};
const row:ConfigRecord={config_id:id,executor_id:executor,version:1,value,deleted_at:null,saved_state:"SAVED",runtime_apply_state:"PENDING",saved_runtime_revision:1,applied_runtime_revision:null,next_focus_revision:1,updated_at:"2026-10-29T00:00:00.000Z"};
beforeEach(()=>{vi.mocked(request).mockReset();});
it("reads a known tombstone using the existing read-only route",async()=>{const tombstone={...row,version:2,deleted_at:"2026-10-30T00:00:00.000Z"};vi.mocked(request).mockResolvedValue(tombstone);expect(await readConfig(executor,id)).toEqual(tombstone);expect(vi.mocked(request).mock.calls[0]).toEqual([`/amvp/configs/${id}`,"GET",undefined,{signal:undefined}]);});
it("rejects another config or installation in a tombstone read",async()=>{vi.mocked(request).mockResolvedValueOnce({...row,config_id:executor}).mockResolvedValueOnce({...row,executor_id:id});await expect(readConfig(executor,id)).rejects.toThrow();await expect(readConfig(executor,id)).rejects.toThrow();});
it("uses create precondition and immutable payload/key for explicit retry",async()=>{
 const draft=structuredClone(value),write=configWrite(executor,id,draft);draft.cycles=9;
 vi.mocked(request).mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce(row).mockResolvedValueOnce(row);
 await expect(write.send()).rejects.toThrow("response lost");await expect(write.send()).resolves.toEqual(row);
 const first=vi.mocked(request).mock.calls[0],second=vi.mocked(request).mock.calls[1];expect(second[3]).toEqual(first[3]);expect(second[2]).toEqual({executor_id:executor,value});expect(first[3]).toMatchObject({create:true,key:write.key});
});
it("readback tolerates JSON key order but refuses another version",async()=>{
 const reordered={...row,value:Object.fromEntries(Object.entries(value).reverse())};vi.mocked(request).mockResolvedValueOnce(row).mockResolvedValueOnce(reordered);
 await expect(configWrite(executor,id,value).send()).resolves.toEqual(reordered);
 vi.mocked(request).mockResolvedValueOnce(row).mockResolvedValueOnce({...row,version:2});await expect(configWrite(executor,id,value).send()).rejects.toThrow();
});
it("does not accept another installation's saved response",async()=>{
 vi.mocked(request).mockResolvedValueOnce({...row,executor_id:id});await expect(configWrite(executor,id,value).send()).rejects.toThrow();expect(request).toHaveBeenCalledTimes(1);
});
it("paginates all saved settings without inventing an empty page",async()=>{
 vi.mocked(request).mockResolvedValueOnce({items:[row],next_cursor:"opaque",has_more:true}).mockResolvedValueOnce({items:[{...row,config_id:"00000000-0000-4000-8000-000000000003"}],next_cursor:null,has_more:false});
 expect(await listConfigs(executor)).toHaveLength(2);expect(vi.mocked(request).mock.calls[1][0]).toContain("cursor=opaque");
});
it("rejects duplicate pages and inconsistent pagination",async()=>{
 vi.mocked(request).mockResolvedValueOnce({items:[row],next_cursor:"opaque",has_more:true}).mockResolvedValueOnce({items:[row],next_cursor:null,has_more:false});await expect(listConfigs(executor)).rejects.toThrow();
 vi.mocked(request).mockResolvedValueOnce({items:[],next_cursor:null,has_more:true});await expect(listConfigs(executor)).rejects.toThrow();
});
it("deletion preserves one request key and returns pending release only",async()=>{
 const deletion=configDelete(row);vi.mocked(request).mockRejectedValueOnce(new Error("lost")).mockResolvedValueOnce({operation_id:id,state:"RELEASE_PENDING",actual_effect_confirmed:false});
 await expect(deletion.send()).rejects.toThrow();await expect(deletion.send()).resolves.toMatchObject({actual_effect_confirmed:false});expect(vi.mocked(request).mock.calls[0][3]).toEqual(vi.mocked(request).mock.calls[1][3]);
});
