import test from "node:test";
import assert from "node:assert/strict";
import { reviewAutomation } from "../src/lib/instagram-automation-review.ts";
const ready = {accountId:"a", connected:true, videoCount:20, dailyCount:10, previewCurrent:true, workerActive:true, stories:"skip", storyCount:0, confirmed:true};
test("activation needs a complete review, including explicit Stories choice",()=>{
 assert.deepEqual(reviewAutomation(ready),[]);
 for(const patch of [{accountId:""},{connected:false},{videoCount:0},{dailyCount:11},{dailyCount:0},{previewCurrent:false},{workerActive:false},{stories:""},{stories:"planned",storyCount:0},{confirmed:false}]) assert.ok(reviewAutomation({...ready,...patch}).length);
 assert.deepEqual(reviewAutomation({...ready,stories:"planned",storyCount:1}),[]);
});
