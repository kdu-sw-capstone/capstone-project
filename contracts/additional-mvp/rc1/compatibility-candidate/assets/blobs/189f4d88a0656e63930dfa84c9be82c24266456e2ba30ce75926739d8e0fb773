using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
public static class NativeLinkTests {
 sealed class BrokenInput:MemoryStream {public override int Read(byte[] b,int offset,int count){throw new IOException("synthetic input failure");}}
 sealed class ObservedOutput:MemoryStream {public bool Closed;protected override void Dispose(bool disposing){Closed=true;base.Dispose(disposing);}}
 static int count;
 static void Check(bool ok){if(!ok)throw new Exception("ASSERTION_FAILED_"+count);count++;}
 static void Reject(Action a){try{a();}catch(InvalidOperationException){count++;return;}throw new Exception("EXPECTED_REJECTION_"+count);}
 static Dictionary<string,object> Binding(){return new Dictionary<string,object>{{"installationId",new string('1',32)},{"extensionId",new string('a',32)},{"userSid","test-sid"},{"chromePID",1234},{"chromeCreatedMs",123456L},{"chromeExecutable",@"C:\Program Files\Google\Chrome\Application\chrome.exe"},{"profile",@"C:\FOCURVE\new\profile"}};}
 static Dictionary<string,object> Request(){return new Dictionary<string,object>{{"contract",NativeLinkHost.Contract},{"operation","HELLO"},{"installationId",new string('1',32)},{"extensionId",new string('a',32)},{"nonce",new string('b',32)}};}
 public static int Main(){
  var b=Binding();var q=Request();var response=NativeLinkHost.ValidateMessage(q,b);Check((string)response["state"]=="CONNECTED");Check((string)response["capability"]=="LINK_ONLY_NO_SERVICE_CONTROL");Check((string)response["nonce"]==new string('b',32));
  foreach(var op in new[]{"START","END","EVALUATE","READ_STORAGE","READ_SAFETY","STOP_SERVER"}){var x=Request();x["operation"]=op;Reject(()=>NativeLinkHost.ValidateMessage(x,b));}
  foreach(var field in new[]{"installationId","extensionId","nonce","contract"}){var x=Request();x[field]="wrong";Reject(()=>NativeLinkHost.ValidateMessage(x,b));}
  var extra=Request();extra["script"]="alert(1)";Reject(()=>NativeLinkHost.ValidateMessage(extra,b));
  var missing=Request();missing.Remove("nonce");Reject(()=>NativeLinkHost.ValidateMessage(missing,b));
  var binary=NativeLinkHost.Frame(response);Check(binary.Length>4);var decoded=NativeLinkHost.Object(NativeLinkHost.ReadFrame(new MemoryStream(binary)));Check((string)decoded["state"]=="CONNECTED");
  Reject(()=>NativeLinkHost.ReadFrame(new MemoryStream(new byte[]{1,0})));Reject(()=>NativeLinkHost.ReadFrame(new MemoryStream(BitConverter.GetBytes(32769))));Reject(()=>NativeLinkHost.ReadFrame(new MemoryStream(new byte[]{4,0,0,0,1})));
  var text=new Dictionary<string,object>{{"label","연결"}};Check((string)NativeLinkHost.Object(NativeLinkHost.ReadFrame(new MemoryStream(NativeLinkHost.Frame(text))))["label"]=="연결");
  string origin="chrome-extension://"+new string('a',32)+"/",exe=(string)b["chromeExecutable"],cmd="\""+exe+"\""+@" --user-data-dir=C:\FOCURVE\new\profile --no-first-run";
  Check(NativeLinkHost.PeerMatches(origin,"test-sid",1234,123456,exe,cmd,b));
  Check(!NativeLinkHost.PeerMatches("https://localhost/","test-sid",1234,123456,exe,cmd,b));
  Check(!NativeLinkHost.PeerMatches(origin,"other-user",1234,123456,exe,cmd,b));
  Check(!NativeLinkHost.PeerMatches(origin,"test-sid",5678,123456,exe,cmd,b));
  Check(!NativeLinkHost.PeerMatches(origin,"test-sid",1234,123460,exe,cmd,b));
  Check(!NativeLinkHost.PeerMatches(origin,"test-sid",1234,123456,exe,cmd.Replace("new\\profile","old\\profile"),b));
  Check(!NativeLinkHost.PeerMatches(origin,"test-sid",1234,123456,exe,"--type=utility",b));
  var runtime=new Dictionary<string,object>{{"contract","FOCURVE_RUNTIME_PROBE_1"},{"operation","OPEN_USER_SESSION"},{"installationId",new string('1',32)},{"extensionId",new string('a',32)}};
  Reject(()=>NativeLinkHost.ValidateRuntimeMessage(runtime,b));b["allowUserSession"]=true;Check(NativeLinkHost.ValidateRuntimeMessage(runtime,b)=="OPEN_USER_SESSION");
  runtime["operation"]="RECOVER_PRODUCT_HOLD";Reject(()=>NativeLinkHost.ValidateRuntimeMessage(runtime,b));
  b["allowProductHoldRecovery"]=true;Check(NativeLinkHost.ValidateRuntimeMessage(runtime,b)=="RECOVER_PRODUCT_HOLD");
  foreach(var op in new[]{"START","END","EVALUATE","READ_STORAGE"}){runtime["operation"]=op;Reject(()=>NativeLinkHost.ValidateRuntimeMessage(runtime,b));}
  runtime["operation"]="OPEN_USER_SESSION";runtime["script"]="untrusted";Reject(()=>NativeLinkHost.ValidateRuntimeMessage(runtime,b));
  var normal=new ObservedOutput();NativeLinkHost.ForwardInputAndClose(new MemoryStream(new byte[]{1,2,3}),normal);Check(normal.Closed);Check(normal.ToArray().Length==3);
  var broken=new ObservedOutput();try{NativeLinkHost.ForwardInputAndClose(new BrokenInput(),broken);throw new Exception("EXPECTED_IO_FAILURE");}catch(IOException){Check(broken.Closed);}
  Console.WriteLine("NativeLink C# contracts: "+count+" PASS; synthetic peer fixtures only");return 0;
 }
}
