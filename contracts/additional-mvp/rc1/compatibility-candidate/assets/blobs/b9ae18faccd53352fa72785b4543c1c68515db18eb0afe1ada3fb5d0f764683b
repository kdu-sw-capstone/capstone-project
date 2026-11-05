using System;using System.IO;using System.Diagnostics;using System.Text;using System.Threading.Tasks;
public static class NativePipeTests {
 public static int Main(string[] args){
  var info=new ProcessStartInfo(args[0],"-I -B -X utf8 \""+args[1]+"\""){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true};
  using(var p=Process.Start(info)){
   byte[] payload=Encoding.UTF8.GetBytes("synthetic-native-reply");var message=new byte[4+payload.Length];Buffer.BlockCopy(BitConverter.GetBytes(payload.Length),0,message,0,4);Buffer.BlockCopy(payload,0,message,4,payload.Length);
   var response=Task.Factory.StartNew(()=>{var h=new byte[4];int done=0;while(done<4){int n=p.StandardOutput.BaseStream.Read(h,done,4-done);if(n==0)throw new Exception("EOF");done+=n;}int count=BitConverter.ToInt32(h,0);var body=new byte[count];done=0;while(done<count){int n=p.StandardOutput.BaseStream.Read(body,done,count-done);if(n==0)throw new Exception("EOF");done+=n;}return Encoding.UTF8.GetString(body);});
   bool fixedMode=args.Length==3&&args[2]=="fixed";
   if(fixedMode)NativeLinkHost.ForwardFrames(new MemoryStream(message),p.StandardInput.BaseStream);else new MemoryStream(message).CopyTo(p.StandardInput.BaseStream);
   bool oldResponded=response.Wait(600);Console.WriteLine("beforeFlushResponse="+oldResponded+"; streamType="+p.StandardInput.BaseStream.GetType().FullName);
   p.StandardInput.BaseStream.Flush();if(!response.Wait(5000)||response.Result!="synthetic-native-reply")throw new Exception("FLUSHED_PIPE_FAILED");p.StandardInput.Close();p.WaitForExit(5000);Console.WriteLine("afterExplicitFlushResponse=PASS; synthetic pipe only");return fixedMode?(oldResponded?0:3):(oldResponded?2:0);
  }
 }
}