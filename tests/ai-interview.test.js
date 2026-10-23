import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAiInterview } from '../supabase/functions/issb-ai-interview/handler.js';
import { createVoiceConnection } from '../src/lib/aiInterview.js';

const userId='3a23dd7d-a3a3-4444-aaaa-121212121212';
const attemptId='4b23dd7d-a3a3-4444-aaaa-121212121212';
const bookingId='5c23dd7d-a3a3-4444-aaaa-121212121212';
const connect={action:'connect',attemptId,bookingId,sdp:'v=0\r\nmock-audio-offer'};
const req=body=>new Request('https://test.local/interview',{method:'POST',body:JSON.stringify(body)});
function fixture({reserveError=null,activate=true,providerOk=true,terminal='completed'}={}) {
  const calls=[],requests=[];
  const db={rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='reserve_issb_ai_attempt')return{data:{id:attemptId},error:reserveError};
    if(name==='activate_issb_ai_attempt')return{data:activate};
    if(name==='finish_issb_ai_attempt')return{data:{id:attemptId,status:terminal,reason:'fullscreen_exit',provider_call_id:'rtc_test',ended_at:'2026-10-22T10:00:00Z'}};
    assert.fail(name);
  }};
  const requestAI=async(url,options)=>{
    requests.push({url,...options});
    if(url.endsWith('/hangup'))return new Response(null,{status:200});
    return new Response(providerOk?'v=0\r\nmock-audio-answer':'provider rejected',{status:providerOk?201:401,headers:{Location:'/v1/realtime/calls/rtc_test'}});
  };
  return{db,calls,requests,options:{db,userId,apiKey:'private-test-value',requestAI}};
}
test('AI service rejects unauthenticated requests, missing setup, and invalid bodies without paid calls',async()=>{
  const f=fixture();
  assert.equal((await handleAiInterview(req(connect),{...f.options,userId:null})).status,401);
  assert.equal((await handleAiInterview(req({action:'check'}),{...f.options,apiKey:null})).status,503);
  assert.equal((await handleAiInterview(req({...connect,sdp:'invalid'}),f.options)).status,400);
  assert.equal((await handleAiInterview(req({...connect,bookingId:'not-a-uuid'}),f.options)).status,400);
  assert.equal(f.calls.length,0);assert.equal(f.requests.length,0);
});
test('a rejected reservation cannot create a paid call',async()=>{
  const f=fixture({reserveError:{code:'P0001',message:'Please wait one minute before trying again.'}});
  const response=await handleAiInterview(req(connect),f.options);
  assert.equal(response.status,409);assert.equal((await response.json()).attemptCreated,false);
  assert.equal(f.requests.length,0);
  assert.equal(f.calls[0].args.p_user_id,userId);
});
test('AI connection uses server credentials, fixed interview instructions, and returns only SDP',async()=>{
  const f=fixture();const response=await handleAiInterview(req(connect),f.options);
  assert.equal(response.status,200);
  const data=await response.json();assert.deepEqual(Object.keys(data).sort(),['attemptId','sdp']);
  assert.equal(f.requests[0].headers.Authorization,'Bearer private-test-value');
  assert.notEqual(f.requests[0].headers['OpenAI-Safety-Identifier'],userId);
  const config=JSON.parse(f.requests[0].body.get('session'));
  assert.equal(config.model,'gpt-realtime-2.1');assert.deepEqual(config.output_modalities,['audio']);
  assert.match(config.instructions,/ONE short question/);assert.match(config.instructions,/cannot see the camera/);
  assert.equal(f.calls[1].name,'activate_issb_ai_attempt');
  assert.equal(f.calls[1].args.p_call_id,'rtc_test');
});
test('provider failures and an already-ended attempt do not activate a practice session',async()=>{
  const failed=fixture({providerOk:false});
  assert.equal((await handleAiInterview(req(connect),failed.options)).status,502);
  assert.equal(failed.calls.at(-1).name,'finish_issb_ai_attempt');
  assert.equal(failed.calls.at(-1).args.p_outcome,'interrupted');
  const ended=fixture({activate:false});
  assert.equal((await handleAiInterview(req(connect),ended.options)).status,502);
  assert.match(ended.requests.at(-1).url,/rtc_test\/hangup$/);
});
test('finishing respects an immutable server failure and hangs up the owned call',async()=>{
  const f=fixture({terminal:'failed'});
  const response=await handleAiInterview(req({action:'finish',attemptId,bookingId,outcome:'completed',reason:'cadet_finished'}),f.options);
  assert.equal((await response.json()).attempt.status,'failed');
  assert.equal(f.calls[0].args.p_user_id,userId);
  assert.match(f.requests[0].url,/rtc_test\/hangup$/);
});
test('WebRTC sends microphone tracks only, starts the spoken greeting, and closes idempotently',async context=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'RTCPeerConnection');
  let peer,closeCount=0,pauseCount=0;const sent=[];
  class FakePeer {
    constructor(){peer=this;this.tracks=[];}
    createDataChannel(){this.channel={readyState:'connecting',send:value=>sent.push(JSON.parse(value)),close:()=>{}};return this.channel;}
    addTrack(track){this.tracks.push(track);}
    async createOffer(){return{type:'offer',sdp:'v=0\r\nlocal-audio'};}
    async setLocalDescription(){}
    async setRemoteDescription(){this.channel.readyState='open';this.channel.onopen();}
    close(){closeCount++;}
  }
  Object.defineProperty(globalThis,'RTCPeerConnection',{configurable:true,value:FakePeer});
  context.after(()=>{if(descriptor)Object.defineProperty(globalThis,'RTCPeerConnection',descriptor);else delete globalThis.RTCPeerConnection;});
  const mic={kind:'audio'},camera={kind:'video'};
  const connection=createVoiceConnection({stream:{getAudioTracks:()=>[mic],getTracks:()=>[mic,camera]},audio:{pause:()=>{pauseCount++;}},client:{functions:{invoke:async(_,options)=>{
    assert.equal(options.body.action,'connect');assert.equal(options.body.bookingId,bookingId);
    return{data:{sdp:'v=0\r\nremote-audio'}};
  }}},attempt:{id:attemptId,bookingId},onEvent:()=>{},onDisconnect:()=>assert.fail('intentional close must not interrupt the session')});
  await connection.connect();connection.greet();
  assert.deepEqual(peer.tracks,[mic]);assert.equal(sent[0].type,'response.create');
  connection.close();connection.close();
  assert.equal(closeCount,1);assert.equal(pauseCount,1);
});
