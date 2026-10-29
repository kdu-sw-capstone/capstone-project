// Actual Windows C# -> Python pipe. No native registration or Chrome/service.
using System;using System.IO;using System.Text;using System.Diagnostics;using System.Threading.Tasks;
public static class NativeInputCloseTests {
 sealed class BrokenInput:MemoryStream {public override int Read(byte[] b,int offset,int count){throw new IOException("synthetic upstream disconnect");}}
 public static int Main(string[] args){
  var info=new ProcessStartInfo(args[0],"-I -B -X utf8 \""+args[1]+"\" \""+args[2]+"\""){
   UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true};
  using(var child=Process.Start(info)){
   var initial=NativeLinkHost.Frame(new System.Collections.Generic.Dictionary<string,object>{{"operation","SYNTHETIC_PIPE_ONLY"}});
   NativeLinkHost.ForwardFrames(new MemoryStream(initial),child.StandardInput.BaseStream);
   var first=Task.Factory.StartNew(()=>NativeLinkHost.Object(NativeLinkHost.ReadFrame(child.StandardOutput.BaseStream)));
   if(!first.Wait(5000)||(string)first.Result["state"]!="SYNTHETIC_READY")throw new Exception("PIPE_ACK_MISSING");
   try{NativeLinkHost.ForwardInputAndClose(new BrokenInput(),child.StandardInput.BaseStream);}catch(IOException){}
   var last=Task.Factory.StartNew(()=>NativeLinkHost.Object(NativeLinkHost.ReadFrame(child.StandardOutput.BaseStream)));
   if(!last.Wait(5000)||(string)last.Result["reason"]!="PRODUCT_CHANNEL_CLOSED")throw new Exception("INPUT_CLOSE_NOT_PROPAGATED");
   if(!child.WaitForExit(5000)||child.ExitCode!=0||child.StandardError.ReadToEnd()!="")throw new Exception("CHILD_EXIT_UNCONFIRMED");
   Console.WriteLine("Windows native broken-input propagation: PASS; child EOF detected and normal child exit; no product services");return 0;
  }
 }
}
