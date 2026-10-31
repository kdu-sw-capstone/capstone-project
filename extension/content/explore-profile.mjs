// Internal selector map, not a Wire policy or authority source.
const HOSTS=new Set(['youtube.com','www.youtube.com']);
export function exploreDestination(url){
  if(url.protocol!=='https:'||!HOSTS.has(url.hostname)||url.port||url.username||url.password)return null;
  if(url.pathname==='/feed/explore')return 'explore';
  if(url.pathname==='/feed/trending')return 'trending';
  if(['/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ','/channel/UC4R8DWoMoI7CAwX8_LjQHig'].includes(url.pathname))return 'channels';
  if(url.pathname==='/feed/storefront'&&url.searchParams.get('bp')==='ogUCKAU=')return 'storefront';
  return null;
}
