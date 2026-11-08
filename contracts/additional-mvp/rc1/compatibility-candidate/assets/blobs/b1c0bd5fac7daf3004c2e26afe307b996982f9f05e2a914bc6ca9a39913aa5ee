// Product-owned HELLO and fixed, hash-pinned lifecycle probe transport.
// No CDP, arbitrary commands, registry writes or AI observer endpoint.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

public static class NativeLinkHost {
 public const string Contract="FOCURVE_NATIVE_LINK_1";
 const int MaxFrame=4096;
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer { MaxJsonLength=MaxFrame, RecursionLimit=8 };
 public static void Need(bool ok,string code){if(!ok)throw new InvalidOperationException(code);}
 public static string Hash(byte[] b){using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(b)).Replace("-","").ToLowerInvariant();}
 public static Dictionary<string,object> Object(byte[] b){return Json.Deserialize<Dictionary<string,object>>(new UTF8Encoding(false,true).GetString(b));}
 public static byte[] ReadFrame(Stream input){
  byte[] head=ReadExact(input,4);int n=BitConverter.ToInt32(head,0);Need(n>0&&n<=MaxFrame,"NATIVE_FRAME_SIZE_REJECTED");return ReadExact(input,n);
 }
 static byte[] ReadExact(Stream s,int n){var b=new byte[n];int done=0;while(done<n){int k=s.Read(b,done,n-done);Need(k>0,"NATIVE_FRAME_INCOMPLETE");done+=k;}return b;}
 public static byte[] Frame(Dictionary<string,object> value){byte[] raw=Encoding.UTF8.GetBytes(Json.Serialize(value));Need(raw.Length<=MaxFrame,"NATIVE_FRAME_SIZE_REJECTED");using(var ms=new MemoryStream()){ms.Write(BitConverter.GetBytes(raw.Length),0,4);ms.Write(raw,0,raw.Length);return ms.ToArray();}}
 public static Dictionary<string,object> ValidateMessage(Dictionary<string,object> q,Dictionary<string,object> b){
  Need(q!=null&&q.Count==5&&q.ContainsKey("contract")&&q.ContainsKey("operation")&&q.ContainsKey("installationId")&&q.ContainsKey("extensionId")&&q.ContainsKey("nonce"),"NATIVE_COMMAND_SHAPE_REJECTED");
  Need(q["contract"] as string==Contract&&q["operation"] as string=="HELLO","NATIVE_OPERATION_REJECTED");
  Need(q["installationId"] as string==(string)b["installationId"]&&q["extensionId"] as string==(string)b["extensionId"],"NATIVE_INSTALLATION_MISMATCH");
  Need(q["nonce"] is string&&Regex.IsMatch((string)q["nonce"],"^[a-f0-9]{32}$"),"NATIVE_NONCE_REJECTED");
  return new Dictionary<string,object>{{"contract",Contract},{"state","CONNECTED"},{"installationId",b["installationId"]},{"extensionId",b["extensionId"]},{"nonce",q["nonce"]},{"capability","LINK_ONLY_NO_SERVICE_CONTROL"}};
 }
 public static string ValidateRuntimeMessage(Dictionary<string,object> q,Dictionary<string,object> b){
  string operation=q!=null&&q.ContainsKey("operation")?q["operation"] as string:null;
  Need(q!=null&&q.Count==4&&q.ContainsKey("contract")&&q["contract"] as string=="FOCURVE_RUNTIME_PROBE_1"&&(operation=="VERIFY_RUNTIME"||operation=="OPEN_USER_SESSION"||operation=="RECOVER_PRODUCT_HOLD")&&q.ContainsKey("installationId")&&q["installationId"] as string==(string)b["installationId"]&&q.ContainsKey("extensionId")&&q["extensionId"] as string==(string)b["extensionId"],"PRODUCT_RUNTIME_COMMAND_REJECTED");
  if(operation=="OPEN_USER_SESSION")Need(b.ContainsKey("allowUserSession")&&b["allowUserSession"] is bool&&(bool)b["allowUserSession"],"PRODUCT_USER_SESSION_NOT_APPROVED");
  if(operation=="RECOVER_PRODUCT_HOLD")Need(b.ContainsKey("allowProductHoldRecovery")&&b["allowProductHoldRecovery"] is bool&&(bool)b["allowProductHoldRecovery"],"PRODUCT_HOLD_RECOVERY_NOT_APPROVED");
  return operation;
 }
 public static bool PeerMatches(string origin,string sid,int pid,long created,string exe,string command,Dictionary<string,object> b){
  if(origin!="chrome-extension://"+(string)b["extensionId"]+"/"||sid!=(string)b["userSid"]||pid!=Convert.ToInt32(b["chromePID"])||Math.Abs(created-Convert.ToInt64(b["chromeCreatedMs"]))>1||!String.Equals(Path.GetFullPath(exe),Path.GetFullPath((string)b["chromeExecutable"]),StringComparison.OrdinalIgnoreCase))return false;
  var m=Regex.Match(command,"(?:^|\\s)--user-data-dir=(?:\"([^\"]+)\"|([^\\s]+))");
  return m.Success&&String.Equals(Path.GetFullPath(m.Groups[1].Success?m.Groups[1].Value:m.Groups[2].Value),Path.GetFullPath((string)b["profile"]),StringComparison.OrdinalIgnoreCase);
 }
 static bool VerifyPeer(string origin,Dictionary<string,object> b){
  int pid=Process.GetCurrentProcess().Id;string sid=WindowsIdentity.GetCurrent().User.Value;
  for(int depth=0;depth<16&&pid>0;depth++){
   using(var search=new ManagementObjectSearcher("SELECT ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine FROM Win32_Process WHERE ProcessId="+pid))
   using(var results=search.Get()){
    bool found=false;int parent=0;
    foreach(ManagementObject row in results){
     found=true;parent=Convert.ToInt32(row["ParentProcessId"]);
     if(pid==Convert.ToInt32(b["chromePID"])){
      var created=ManagementDateTimeConverter.ToDateTime((string)row["CreationDate"]).ToUniversalTime();
      long ms=(long)(created-new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalMilliseconds;
      return PeerMatches(origin,sid,pid,ms,(string)row["ExecutablePath"],(string)row["CommandLine"],b);
     }
    }
    if(!found||parent==pid)return false;pid=parent;
   }
  }return false;
 }
 public static void ForwardFrames(Stream input,Stream output){
  byte[] buffer=new byte[4096];int count;
  while((count=input.Read(buffer,0,buffer.Length))>0){output.Write(buffer,0,count);output.Flush();}
 }
 public static void ForwardInputAndClose(Stream input,Stream output){
  // Broken native input must reach the child's EOF handler too. It is not a
  // stop/cleanup request, and never terminates a service or retries a command.
  try{ForwardFrames(input,output);}finally{output.Close();}
 }
 static int RunRuntimeProbe(byte[] first,Dictionary<string,object> b,string directory){
  Need(b.ContainsKey("allowRuntimeProbe")&&b["allowRuntimeProbe"] is bool&&(bool)b["allowRuntimeProbe"],"PRODUCT_RUNTIME_NOT_APPROVED");
  string installation=(string)b["installationPath"],python=(string)b["pythonExecutable"],script=Path.Combine(installation,@"control\installer\product_runtime_entry.py");
  var files=b["runtimeFiles"] as Dictionary<string,object>;Need(files!=null&&files.Count>=4,"PRODUCT_RUNTIME_FILES_UNCONFIRMED");
  foreach(var row in files){string file=Path.GetFullPath(Path.Combine(installation,row.Key));Need(file.StartsWith(Path.GetFullPath(installation)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase)&&Hash(File.ReadAllBytes(file))==(string)row.Value,"PRODUCT_RUNTIME_FILE_HASH_MISMATCH");}
  Need(!python.Contains("\"")&&!script.Contains("\""),"PRODUCT_RUNTIME_PATH_REJECTED");
  var info=new ProcessStartInfo(python,"-I -B -X utf8 \""+script+"\""){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true};
  var keys=new List<string>();foreach(string key in info.EnvironmentVariables.Keys)keys.Add(key);
  foreach(string key in keys){string u=key.ToUpperInvariant();if(u.StartsWith("PYTHON")||u.StartsWith("MEMBER_")||u.StartsWith("MAIL_")||u.StartsWith("SMTP_")||u.StartsWith("SPRING_")||u.StartsWith("FOCURVE_")||u=="JAVA_TOOL_OPTIONS"||u=="JDK_JAVA_OPTIONS"||u=="_JAVA_OPTIONS"||u=="CLASSPATH"||u=="NODE_OPTIONS")info.EnvironmentVariables.Remove(key);}
  using(var child=Process.Start(info)){
   byte[] frame=new byte[first.Length+4];Buffer.BlockCopy(BitConverter.GetBytes(first.Length),0,frame,0,4);Buffer.BlockCopy(first,0,frame,4,first.Length);child.StandardInput.BaseStream.Write(frame,0,frame.Length);child.StandardInput.BaseStream.Flush();
   System.Threading.Tasks.Task.Factory.StartNew(()=>{try{ForwardInputAndClose(Console.OpenStandardInput(),child.StandardInput.BaseStream);}catch{}});
   var errors=child.StandardError.ReadToEndAsync();ForwardFrames(child.StandardOutput.BaseStream,Console.OpenStandardOutput());child.WaitForExit();
   // Never forward private subprocess errors or database/credential details.
   if(child.ExitCode!=0)Console.Error.WriteLine("PRODUCT_RUNTIME_PROCESS_UNCONFIRMED");return child.ExitCode;
  }
 }
 public static int Main(string[] args){
  try{
   string directory=Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
   byte[] raw=File.ReadAllBytes(Path.Combine(directory,"binding.json"));Need(Hash(raw)==NativeLinkBuild.BindingSHA256,"NATIVE_BINDING_HASH_MISMATCH");
   var b=Object(raw);Need((string)b["contract"]=="FOCURVE_NATIVE_BINDING_1","NATIVE_BINDING_VERSION_MISMATCH");
   Need(DateTimeOffset.UtcNow<DateTimeOffset.Parse((string)b["notAfterUTC"]),"NATIVE_LINK_SCOPE_EXPIRED");
   Need(args.Length>=1&&args.Length<=2,"NATIVE_CALLER_REQUIRED");
   Need(args.Length==1||Regex.IsMatch(args[1],"^--parent-window=[0-9]+$"),"NATIVE_ARGUMENT_REJECTED");
   Need(VerifyPeer(args[0],b),"NATIVE_CHROME_PARENT_UNVERIFIED");
   Dictionary<string,object> q;
   // A stalled or absent request cannot keep an owned native process alive.
   var work=System.Threading.Tasks.Task.Factory.StartNew(()=>ReadFrame(Console.OpenStandardInput()));
   Need(work.Wait(TimeSpan.FromSeconds(5)),"NATIVE_FRAME_TIMEOUT");q=Object(work.Result);
   if(q.ContainsKey("contract")&&q["contract"] as string=="FOCURVE_RUNTIME_PROBE_1"){
    ValidateRuntimeMessage(q,b);
    return RunRuntimeProbe(work.Result,b,directory);
   }
   var reply=ValidateMessage(q,b);byte[] framed=Frame(reply);var stdout=Console.OpenStandardOutput();stdout.Write(framed,0,framed.Length);stdout.Flush();return 0;
  }catch(Exception e){
   string code=e is InvalidOperationException?e.Message:"NATIVE_LINK_UNCONFIRMED";
   Console.Error.WriteLine(code);return 1;
  }
 }
}
