package kr.ac.kdu.focurve;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import kr.ac.kdu.focurve.api.ApiFailure;
import kr.ac.kdu.focurve.auth.*;
import kr.ac.kdu.focurve.execution.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class ConsentBoundaryTest {
  @Test
  void memberBearerCannotApproveAnotherInstallationWithoutWebConfirmation() {
    var links = mock(MemberLinks.class);
    var web = mock(WebAuthentication.class);
    var controller = new LinkController(links, web, mock(AuthRateLimits.class));
    var request = new MockHttpServletRequest();
    request.addHeader("Authorization", "Bearer synthetic-member-token");
    assertThatThrownBy(
            () ->
                controller.approve("synthetic-request", new LinkController.Approval(true), request))
        .isInstanceOfSatisfying(
            ApiFailure.class,
            failure -> assertThat(failure.code).isEqualTo("WEB_CONFIRMATION_REQUIRED"));
    verifyNoInteractions(links, web);
  }

  @Test
  void socialLinkWithoutExplicitConsentNeverConsumesTicketOrChangesIdentity() {
    var social = mock(SocialAuthentication.class);
    var controller = new SocialController(social);
    for (Boolean consent : new Boolean[] {null, false})
      assertThatThrownBy(
              () ->
                  controller.link(
                      new SocialController.Ticket("synthetic-ticket", consent),
                      new MockHttpServletRequest()))
          .isInstanceOfSatisfying(
              ApiFailure.class, failure -> assertThat(failure.code).isEqualTo("CONSENT_REQUIRED"));
    verifyNoInteractions(social);
  }
}
