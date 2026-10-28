package kr.ac.kdu.focurve.auth;

public interface MailDelivery {
  void send(String address, String kind, String token);
}
