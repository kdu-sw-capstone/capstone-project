import {render,screen,fireEvent} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import HostScopeEditor from "./HostScopeEditor";
it("editing one host preserves the other host's subdomain flag",()=>{
 const rows=[{host:"one.example.test",include_subdomains:true},{host:"two.example.test",include_subdomains:false}],change=vi.fn();render(<HostScopeEditor title="예외" rows={rows} onChange={change}/>);
 fireEvent.change(screen.getByLabelText("예외 도메인 2"),{target:{value:"new.example.test"}});expect(change).toHaveBeenCalledWith([rows[0],{host:"new.example.test",include_subdomains:false}]);expect(rows[0].include_subdomains).toBe(true);
});
it("a host with credentials is visibly rejected rather than normalized silently",()=>{
 const change=vi.fn();render(<HostScopeEditor title="예외" rows={[{host:"https://name:synthetic@example.test",include_subdomains:false}]} onChange={change}/>);fireEvent.blur(screen.getByLabelText("예외 도메인 1"));expect(screen.getByRole("alert")).toHaveTextContent("도메인을 확인");expect(change).not.toHaveBeenCalled();
});
