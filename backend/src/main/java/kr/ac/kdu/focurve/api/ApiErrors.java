package kr.ac.kdu.focurve.api;

import java.util.*;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler(ApiFailure.class)
  public ResponseEntity<?> failure(ApiFailure e) {
    var response = ResponseEntity.status(e.status);
    if (e.status == 429 || e.status == 503) response.header("Retry-After", "60");
    return response.body(body(e.code, e.status == 429 || e.status == 503));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<?> invalid() {
    return ResponseEntity.status(422).body(body("VALIDATION_FAILED", false));
  }

  @ExceptionHandler(
      org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
  public ResponseEntity<?> invalidParameter() {
    return ResponseEntity.status(422).body(body("VALIDATION_FAILED", false));
  }

  @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
  public ResponseEntity<?> notFound() {
    return ResponseEntity.status(404).body(body("RESOURCE_NOT_FOUND", false));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<?> unexpected() {
    // SQL, password, provider response and token details never enter the response.
    return ResponseEntity.status(500).body(body("INTERNAL_ERROR", true));
  }

  @ExceptionHandler(org.springframework.web.HttpRequestMethodNotSupportedException.class)
  public ResponseEntity<?> unsupportedMethod() {
    return ResponseEntity.status(405).body(body("METHOD_NOT_ALLOWED", false));
  }

  @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
  public ResponseEntity<?> unsupportedMedia() {
    return ResponseEntity.status(415).body(body("UNSUPPORTED_MEDIA_TYPE", false));
  }

  public static Map<String, Object> body(String code, boolean retryable) {
    return Map.of(
        "error",
        Map.of("code", code, "message", code, "field_errors", List.of(), "retryable", retryable),
        "request_id",
        UUID.randomUUID().toString());
  }
}
