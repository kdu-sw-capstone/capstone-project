import{it,expect}from'vitest';import{metricPercentage}from'./metricPercentage';
it.each([[0,'0.0'],[.5,'50.0'],[2/3,'66.7'],[1,'100.0']])('fraction %s formats as %s percent',(input,expected)=>expect(metricPercentage(input)).toBe(expected));
it.each([null,undefined,NaN,Infinity,-1,1.01,'0.5'])('invalid/unknown %s is not fabricated zero',input=>expect(metricPercentage(input)).toBeNull());
