import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import MemberApp from "./MemberApp";
vi.mock("./FocusSessions",()=>({default:({cadenceSettings}:{cadenceSettings:()=>void})=><button onClick={cadenceSettings}>반복 설정 확인·수정</button>}));
vi.mock("./Settings",()=>({default:()=> <h3>설정 경로 확인</h3>}));
vi.mock("./api",async original=>({...await original<typeof import("./api")>(),request:vi.fn(async(path:string)=>{
 if(path==="/auth/me")return {user_id:"1",display_name:"isolated",providers:["EMAIL"]};
 if(path==="/dashboard")return {current_session:null,recent_sessions:[],recent_access:[],summary:{quality:"NOT_COLLECTED"}};
 if(path.startsWith("/sites"))return {items:[],has_more:false,next_cursor:null};
 if(path.startsWith("/statistics"))return {quality:"NOT_COLLECTED"};
 throw Error("Unexpected isolated request "+path);
})}));
afterEach(()=>{cleanup();window.history.replaceState(null,"","/");});
it("routes the session's cadence settings action to the actual account/settings branch",async()=>{
 window.history.replaceState(null,"","/?view=sessions");render(<MemberApp/>);fireEvent.click(await screen.findByRole("button",{name:"반복 설정 확인·수정"}));expect(await screen.findByRole("heading",{name:"설정 경로 확인"})).toBeInTheDocument();
});
