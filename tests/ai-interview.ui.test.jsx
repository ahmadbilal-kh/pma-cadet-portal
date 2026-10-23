import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AiInterviewPage from '../src/pages/AiInterviewPage';
import { cacheBooking, readBooking } from '../src/lib/issb';
import { rememberedAttempt, rememberAttempt } from '../src/lib/aiInterview';

const state=vi.hoisted(()=>({client:{functions:{invoke:vi.fn()},from:vi.fn()},connection:null}));
const auth=vi.hoisted(()=>({user:{id:'u1',email:'cadet@example.test'}}));
vi.mock('../src/lib/supabase',()=>({supabase:state.client}));
vi.mock('../src/context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../src/lib/aiInterview',async original=>({...await original(),
  playSpeakerTest:vi.fn().mockResolvedValue(undefined),
  createVoiceConnection:vi.fn(options=>{state.connection={options,connect:vi.fn().mockResolvedValue(undefined),greet:vi.fn(),close:vi.fn()};return state.connection;}),
}));
let full=null,tracks,media;
const open=()=>render(<MemoryRouter><AiInterviewPage /></MemoryRouter>);
beforeEach(()=>{
  localStorage.clear();full=null;state.connection=null;
  tracks=[{kind:'audio',stop:vi.fn(),onended:null},{kind:'video',stop:vi.fn(),onended:null}];
  media={getTracks:()=>tracks,getAudioTracks:()=>[tracks[0]],getVideoTracks:()=>[tracks[1]]};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue(media)}});
  vi.stubGlobal('RTCPeerConnection',vi.fn());
  Object.defineProperty(document,'fullscreenEnabled',{configurable:true,value:true});
  Object.defineProperty(document,'fullscreenElement',{configurable:true,get:()=>full});
  HTMLElement.prototype.requestFullscreen=vi.fn(async function(){full=this;document.dispatchEvent(new Event('fullscreenchange'));});
  document.exitFullscreen=vi.fn(async()=>{full=null;document.dispatchEvent(new Event('fullscreenchange'));});
  state.client.from.mockImplementation(table=>{
    const chain={select:()=>chain,eq:()=>chain,order:()=>chain,limit:()=>chain,maybeSingle:async()=>({data:table==='issb_bookings'?readBooking('u1'):null})};return chain;
  });
  state.client.functions.invoke.mockReset().mockImplementation(async(_, {body})=>({data:body.action==='check'?{ready:true}:{attempt:{id:body.attemptId,status:body.outcome,reason:body.reason,endedAt:new Date().toISOString()}}}));
  cacheBooking('u1',{id:'booking',status:'scheduled',fullName:'Cadet Bilal',email:auth.user.email,startsAt:Date.now()+86400000,timezone:'Asia/Karachi',synced:true});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();delete HTMLElement.prototype.requestFullscreen;delete document.exitFullscreen;});
async function devices(){fireEvent.click(await screen.findByRole('button',{name:'Allow devices'}));await screen.findByText('Devices connected. Check your preview.');}
async function ready(){await devices();fireEvent.click(screen.getByRole('button',{name:'Play test sound'}));fireEvent.click(await screen.findByLabelText('I heard the test sound.'));}
async function joined(){await ready();fireEvent.click(screen.getByRole('button',{name:'Join fullscreen interview'}));await screen.findByText('Microphone live');}

test('setup requires devices and an audible speaker check and has no written answer fields',async()=>{
  open();await screen.findByRole('heading',{name:'Meet your AI interviewer.'});
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByRole('button',{name:'Join fullscreen interview'}).disabled).toBe(true);
  await devices();expect(screen.getByRole('button',{name:'Join fullscreen interview'}).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Play test sound'}));fireEvent.click(await screen.findByLabelText('I heard the test sound.'));
  expect(screen.getByRole('button',{name:'Join fullscreen interview'}).disabled).toBe(false);
});
test('denying device permission keeps setup available without starting an attempt',async()=>{
  navigator.mediaDevices.getUserMedia.mockRejectedValueOnce(new DOMException('Denied','NotAllowedError'));
  open();fireEvent.click(await screen.findByRole('button',{name:'Allow devices'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Allow camera and microphone access');
  expect(rememberedAttempt('u1')).toBeNull();expect(state.connection).toBeNull();
});
test('a denied fullscreen request never connects to AI or fails an unstarted interview',async()=>{
  open();await ready();HTMLElement.prototype.requestFullscreen.mockRejectedValueOnce(new Error('Fullscreen denied'));
  fireEvent.click(screen.getByRole('button',{name:'Join fullscreen interview'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Fullscreen denied');
  expect(rememberedAttempt('u1')).toBeNull();expect(state.connection).toBeNull();
});
test('leaving fullscreen ends the attempt as not passed and releases camera, microphone, and AI',async()=>{
  open();await joined();const connection=state.connection;
  await act(async()=>{full=null;document.dispatchEvent(new Event('fullscreenchange'));});
  await screen.findByRole('heading',{name:'Interview not passed.'});
  expect(connection.close).toHaveBeenCalledTimes(1);
  tracks.forEach(track=>expect(track.stop).toHaveBeenCalledTimes(1));
  expect(rememberedAttempt('u1').status).toBe('failed');
  expect(state.client.functions.invoke).toHaveBeenCalledWith('issb-ai-interview',expect.objectContaining({body:expect.objectContaining({action:'finish',outcome:'failed',reason:'fullscreen_exit'})}));
  expect(screen.queryByRole('button',{name:'Finish interview'})).toBeNull();
});
test('normal completion disarms the fullscreen failure listener',async()=>{
  open();await joined();fireEvent.click(screen.getByRole('button',{name:'Finish interview'}));
  await screen.findByRole('heading',{name:'Interview completed.'});
  await waitFor(()=>expect(rememberedAttempt('u1').pending).toBe(false));
  expect(rememberedAttempt('u1').status).toBe('completed');
  const finishes=state.client.functions.invoke.mock.calls.filter(([,options])=>options.body.action==='finish');
  expect(finishes).toHaveLength(1);expect(finishes[0][1].body.outcome).toBe('completed');
});
test('failed account writes preserve a local failed outcome and expose retry',async()=>{
  open();await joined();
  state.client.functions.invoke.mockResolvedValueOnce({error:new Error('Offline')});
  await act(async()=>{full=null;document.dispatchEvent(new Event('fullscreenchange'));});
  await screen.findByRole('button',{name:'Retry saving result'});
  expect(rememberedAttempt('u1').pending).toBe(true);expect(rememberedAttempt('u1').status).toBe('failed');
  fireEvent.click(screen.getByRole('button',{name:'Retry saving result'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Retry saving result'})).toBeNull());
  expect(rememberedAttempt('u1').status).toBe('failed');
});
test('reloading an active attempt records failure instead of resuming practice',async()=>{
  rememberAttempt('u1',{id:'active-attempt',bookingId:'booking',status:'active'});
  open();await screen.findByRole('heading',{name:'Interview not passed.'});
  expect(rememberedAttempt('u1').reason).toBe('page_left');
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
});
test('camera disconnection ends the call as interrupted and cannot be completed',async()=>{
  open();await joined();await act(async()=>{tracks[1].onended();});
  await screen.findByRole('heading',{name:'Interview interrupted.'});
  expect(rememberedAttempt('u1').status).toBe('interrupted');
});
