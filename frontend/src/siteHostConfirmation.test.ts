import {it,expect} from 'vitest';
import {submittedSiteHost} from './siteHostConfirmation';
it.each([
  ['youtube.com','youtube.com'],
  ['https://YOUTUBE.com./watch?v=sample#part','youtube.com'],
  ['  https://www.youtube.com/shorts/sample  ','www.youtube.com'],
  ['https://faß.de/path','xn--fa-hia.de'],
  ['https://例え.テスト/','xn--r8jz45g.xn--zckzah'],
  ['https://sub.example.com/path','sub.example.com'],
])('confirms accepted DNS input %s without collapsing host', (input,expected)=>{
  expect(submittedSiteHost(input)).toBe(expected);
});
it.each(['','https://[invalid','file:///tmp/local'])('unconfirmable input %s has no assumed host',input=>{
  expect(submittedSiteHost(input)).toBeNull();
});
