package kr.ac.kdu.focurve;
import org.springframework.stereotype.Controller;import org.springframework.context.annotation.Profile;import org.springframework.web.bind.annotation.GetMapping;
@Profile("member-runtime | local-integration") @Controller
class MemberSpaRoutes {
 @GetMapping({"/dashboard","/settings","/extension"})String page(){return "forward:/index.html";}
}
