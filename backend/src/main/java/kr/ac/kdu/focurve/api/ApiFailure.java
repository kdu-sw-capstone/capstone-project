package kr.ac.kdu.focurve.api;

public class ApiFailure extends RuntimeException {
  public final int status;
  public final String code;
  public final Long retryAfterSeconds;

  public ApiFailure(int status, String code) {
    this(status, code, null);
  }

  public ApiFailure(int status, String code, Long retryAfterSeconds) {
    super(code);
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
