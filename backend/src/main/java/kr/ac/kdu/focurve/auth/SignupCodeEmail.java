package kr.ac.kdu.focurve.auth;
import java.nio.charset.StandardCharsets;
import java.io.IOException;
public final class SignupCodeEmail {
 private SignupCodeEmail(){}
 public static String html(String code,boolean development){
  if(code==null||!code.matches("[0-9]{6}"))throw new IllegalArgumentException("Invalid signup code format");
  try(var input=SignupCodeEmail.class.getResourceAsStream("/mail/signup-code.html")){
   if(input==null)throw new IllegalStateException("Signup email template missing");
   return new String(input.readAllBytes(),StandardCharsets.UTF_8).replace("{{CODE}}",code).replace("{{DEVELOPMENT_NOTICE}}",development?"<br>개발용 Mailpit 메일이며 외부 발송이 아닙니다.":"");
  }catch(IOException e){throw new IllegalStateException("Signup email template unavailable");}
 }
 public static String text(String code,boolean development){
  if(code==null||!code.matches("[0-9]{6}"))throw new IllegalArgumentException("Invalid signup code format");
  return "FOCURVE\n회원가입 이메일 인증\n\n가입 화면에 아래 인증번호를 입력해주세요.\n인증번호: "+code+"\n\n유효시간 10분 · 한 번만 사용 가능\n인증번호를 다시 받으면 이전 번호는 사용할 수 없습니다.\n요청하지 않았다면 이 메일을 무시해주세요.\n인증번호를 다른 사람에게 공유하지 마세요.\n\nFOCURVE · 집중 행동 관리\n이 메일은 자동 발송됩니다. 회신하지 말아주세요.\n"+(development?"개발용 Mailpit 메일이며 외부 발송이 아닙니다.\n":"");
 }
}
