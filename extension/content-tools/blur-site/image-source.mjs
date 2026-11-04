export function allowedImage(value) {
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('IMAGE_SOURCE_UNSUPPORTED');
  return url.href;
}
