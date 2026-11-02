// User labels stay in memory. Metrics describe only labeled, completed images.
export function evaluateBlurResults(results, labels) {
  let tp=0,tn=0,fp=0,fn=0,unlabeled=0;const completed=new Set();
  for(const result of results){
    if(!['SAFE','SENSITIVE'].includes(result.verdict))continue;
    completed.add(String(result.index));
    const expected=labels[result.index];
    if(!['SAFE','SENSITIVE'].includes(expected)){unlabeled++;continue;}
    if(expected==='SENSITIVE'){result.verdict==='SENSITIVE'?tp++:fn++;}
    else{result.verdict==='SAFE'?tn++:fp++;}
  }
  const labeled=tp+tn+fp+fn;
  const labeledPending=Object.entries(labels).filter(([index,label])=>['SAFE','SENSITIVE'].includes(label)&&!completed.has(index)).length;
  return {labeled,unlabeled,labeled_pending_or_failed:labeledPending,true_positive:tp,true_negative:tn,false_positive:fp,false_negative:fn,
    precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,accuracy:labeled?(tp+tn)/labeled:null,
    representative_dataset_verified:false};
}
