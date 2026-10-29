import java.security.*;
import java.sql.*;
import java.util.*;
/** Fresh-install helper. No Spring context, fixtures, account creation or schema cleanup. */
public final class InstallTools {
 public static void main(String[] args) throws Exception {
  if(args.length!=1)throw new IllegalArgumentException("MODE_REQUIRED");
  if(args[0].equals("identity")){
   KeyPairGenerator g=KeyPairGenerator.getInstance("RSA");g.initialize(2048);
   byte[] publicKey=g.generateKeyPair().getPublic().getEncoded();
   byte[] h=MessageDigest.getInstance("SHA-256").digest(publicKey);
   StringBuilder id=new StringBuilder();for(int i=0;i<16;i++){id.append((char)('a'+((h[i]>>>4)&15)));id.append((char)('a'+(h[i]&15)));}
   System.out.println("{\"extensionId\":\""+id+"\",\"key\":\""+Base64.getEncoder().encodeToString(publicKey)+"\"}");return;
  }
  if(args[0].equals("certificateAlias")){
   KeyStore ks=KeyStore.getInstance("PKCS12");try(var in=new java.io.FileInputStream(System.getenv("FOCURVE_NEW_PFX_PATH"))){ks.load(in,System.getenv("FOCURVE_NEW_PFX_PASSWORD").toCharArray());}
   String found=null;for(var names=ks.aliases();names.hasMoreElements();){String n=names.nextElement();if(ks.isKeyEntry(n)){if(found!=null)throw new IllegalStateException("MULTIPLE_CERTIFICATE_KEYS");found=n;}}
   if(found==null)throw new IllegalStateException("CERTIFICATE_KEY_MISSING");System.out.println(found);return;
  }
  String url=System.getenv("DB_URL"),user=System.getenv("DB_USERNAME"),pass=System.getenv("DB_PASSWORD");
  if(url==null||!url.matches("jdbc:mysql://127\\.0\\.0\\.1:[0-9]+/focurve_user_[a-f0-9]{32}\\?.*"))throw new IllegalStateException("NEW_INSTALL_DB_REQUIRED");
  if(args[0].equals("migrate")){
   Class<?> f=Class.forName("org.flywaydb.core.Flyway");Object c=f.getMethod("configure").invoke(null);
   Class<?> cc=c.getClass();cc.getMethod("dataSource",String.class,String.class,String.class).invoke(c,url,user,pass);
   cc.getMethod("locations",String[].class).invoke(c,(Object)new String[]{"classpath:db/migration"});
   cc.getMethod("cleanDisabled",boolean.class).invoke(c,true);
   Object flyway=cc.getMethod("load").invoke(c);f.getMethod("migrate").invoke(flyway);
   try(Connection db=DriverManager.getConnection(url,user,pass);Statement s=db.createStatement();ResultSet rs=s.executeQuery("SELECT COUNT(*) FROM users")){
    if(!rs.next()||rs.getLong(1)!=0)throw new IllegalStateException("FRESH_INSTALL_MUST_HAVE_ZERO_USERS");
   }
   System.out.println("FRESH_SCHEMA_MIGRATED_ZERO_USERS");return;
  }
  if(args[0].equals("productHoldSafety")){
   String owner=System.getenv("FOCURVE_HOLD_OWNER"),executor=System.getenv("FOCURVE_HOLD_EXECUTOR");
   if(owner==null||!owner.matches("[1-9][0-9]*")||executor==null||!executor.matches("[a-f0-9-]{36}"))throw new IllegalStateException("HOLD_IDENTITY_REQUIRED");
   try(Connection db=DriverManager.getConnection(url,user,pass)){
    db.setReadOnly(true);db.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);db.setAutoCommit(false);
    try(Statement tx=db.createStatement()){
     tx.execute("SET TRANSACTION READ ONLY");tx.execute("START TRANSACTION WITH CONSISTENT SNAPSHOT");
    }
    try(Statement s=db.createStatement();ResultSet rs=s.executeQuery("SELECT @@global.time_zone,@@session.time_zone")){
     if(!rs.next()||!"+00:00".equals(rs.getString(1))||!"+00:00".equals(rs.getString(2)))throw new IllegalStateException("DATABASE_UTC_CONFIGURATION_UNCONFIRMED");
    }
    try(Statement s=db.createStatement();ResultSet rs=s.executeQuery("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('focus_sessions','active_execution_locks','event_receipts','extension_installations') AND engine='InnoDB'")){
     if(!rs.next()||rs.getInt(1)!=4)throw new IllegalStateException("HOLD_TRANSACTIONAL_SCHEMA_UNCONFIRMED");
    }
    long[] counts=new long[3];String[] q={"SELECT COUNT(*) FROM focus_sessions WHERE execution_status NOT IN ('ENDED','START_FAILED','INTERRUPTED')","SELECT COUNT(*) FROM active_execution_locks","SELECT COUNT(*) FROM event_receipts WHERE status IN ('PENDING_DEPENDENCY','REJECTED')"};
    for(int i=0;i<q.length;i++)try(Statement s=db.createStatement();ResultSet rs=s.executeQuery(q[i])){if(!rs.next())throw new IllegalStateException("HOLD_SAFETY_UNCONFIRMED");counts[i]=rs.getLong(1);}
    boolean same=false;
    try(PreparedStatement s=db.prepareStatement("SELECT current_user_id FROM extension_installations WHERE id=?")){
     s.setString(1,executor);try(ResultSet rs=s.executeQuery()){same=rs.next()&&owner.equals(rs.getString(1))&&!rs.next();}
    }
    db.rollback();System.out.println("{\"activeSessions\":"+counts[0]+",\"locks\":"+counts[1]+",\"unresolvedReceipts\":"+counts[2]+",\"ownerMatches\":"+same+"}");
   }return;
  }
  if(!args[0].equals("safety"))throw new IllegalArgumentException("UNKNOWN_MODE");
  String[] queries={"SELECT COUNT(*) FROM focus_sessions WHERE execution_status NOT IN ('ENDED','START_FAILED','INTERRUPTED')","SELECT COUNT(*) FROM active_execution_locks","SELECT COUNT(*) FROM event_receipts WHERE status IN ('PENDING_DEPENDENCY','REJECTED')"};
  List<Long> counts=new ArrayList<>();try(Connection db=DriverManager.getConnection(url,user,pass)){db.setReadOnly(true);try(Statement s=db.createStatement();ResultSet rs=s.executeQuery("SELECT @@global.time_zone,@@session.time_zone")){if(!rs.next()||!"+00:00".equals(rs.getString(1))||!"+00:00".equals(rs.getString(2)))throw new IllegalStateException("DATABASE_UTC_CONFIGURATION_UNCONFIRMED");}for(String q:queries)try(Statement s=db.createStatement();ResultSet rs=s.executeQuery(q)){rs.next();counts.add(rs.getLong(1));}}
  System.out.println("{\"activeSessions\":"+counts.get(0)+",\"locks\":"+counts.get(1)+",\"unresolvedReceipts\":"+counts.get(2)+"}");
 }
}
