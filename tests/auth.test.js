import test from 'node:test';
import assert from 'node:assert/strict';
import { loginAccount, registerAccount, validateRegistration } from '../src/lib/registration.js';
import { setRegistrationHandoff, takeRegistrationHandoff } from '../src/lib/registrationHandoff.js';
const form = { fullName:'  Ahmad Bilal  ', email:'cadet@example.test', password:'example-test-only', origin:'http://localhost:5173' };
test('registration sends name and credentials to auth and requests login confirmation redirect', async()=>{
 let request;
 const client={auth:{signUp:async data=>{request=data;return {data:{user:{id:'u1',identities:[{}]},session:null},error:null};}}};
 const result=await registerAccount(client,form);
 assert.deepEqual(request,{email:form.email,password:form.password,options:{data:{full_name:'Ahmad Bilal'},emailRedirectTo:'http://localhost:5173/login'}});
 assert.equal(result.confirmationRequired,true);
});
test('confirmation-disabled signup still reports success without logging the main app in',async()=>{
 const client={auth:{signUp:async()=>({data:{user:{id:'u1',identities:[{}]},session:{access_token:'test'}},error:null})}};
 assert.equal((await registerAccount(client,form)).confirmationRequired,false);
});
test('signup errors do not produce a successful registration',async()=>{
 await assert.rejects(registerAccount({auth:{signUp:async()=>({error:new Error('Registration failed')})}},form),/Registration failed/);
});

test('email sending limits show a useful error and never report successful signup',async()=>{
 for(const error of [{code:'over_email_send_rate_limit'}, {message:'email rate limit exceeded'}]) {
  const client={auth:{signUp:async()=>({data:{user:{id:'u1',identities:[{}]}},error})}};
  await assert.rejects(registerAccount(client,form),/confirmation email sending limit has been reached/);
 }
});
test('concealed duplicate signup does not count as a new account',async()=>{
 await assert.rejects(registerAccount({auth:{signUp:async()=>({data:{user:{identities:[]}},error:null})}},form),/could not be confirmed/);
});
test('credential handoff is one-use and entirely in memory',()=>{
 setRegistrationHandoff(form.email,form.password);
 assert.deepEqual(takeRegistrationHandoff(),{email:form.email,password:form.password});
 assert.equal(takeRegistrationHandoff(),null);
});

test('registration rejects invalid names, emails, short passwords and mismatched confirmation',()=>{
 const valid={...form,confirmPassword:form.password};
 for(const invalid of [{fullName:' '},{email:'invalid'},{password:'short',confirmPassword:'short'},{confirmPassword:'different'}]) {
  assert.throws(()=>validateRegistration({...valid,...invalid}));
 }
 assert.deepEqual(validateRegistration({...valid,email:'  CADET@Example.Test  '}),{
  fullName:'Ahmad Bilal',email:'cadet@example.test',password:form.password,
 });
});

test('invalid registration never contacts the account service',async()=>{
 let called=false;
 const client={auth:{signUp:async()=>{called=true;}}};
 await assert.rejects(registerAccount(client,{...form,password:'short'}),/8 to 128/);
 assert.equal(called,false);
});

test('signup credentials prefill login and authenticate against the registered account',async()=>{
 // An in-memory service double exercises the app flow, not a live Supabase connection.
 let account;
 const client={auth:{
  signUp:async request=>{
   account=request;
   return {data:{user:{id:'saved-user',identities:[{}]},session:null},error:null};
  },
  signInWithPassword:async request=>request.email===account.email && request.password===account.password
   ? {data:{user:{id:'saved-user'},session:{access_token:'test-session'}},error:null}
   : {data:null,error:{code:'invalid_credentials',message:'Invalid login credentials'}},
 }};
 await registerAccount(client,{...form,email:'  CADET@EXAMPLE.TEST  '});
 assert.equal(account.options.data.full_name,'Ahmad Bilal');
 setRegistrationHandoff(account.email,form.password);
 const credentials=takeRegistrationHandoff();
 assert.equal(credentials.email,'cadet@example.test');
 const login=await loginAccount(client,credentials);
 assert.equal(login.user.id,'saved-user');
 assert.ok(login.session);
 await assert.rejects(loginAccount(client,{...credentials,password:'wrong-password'}),/Invalid email or password/);
 await assert.rejects(loginAccount(client,{...credentials,email:'other@example.test'}),/Invalid email or password/);
 assert.equal(takeRegistrationHandoff(),null);
});

test('unconfirmed accounts receive a useful login error',async()=>{
 const client={auth:{signInWithPassword:async()=>({error:{code:'email_not_confirmed'}})}};
 await assert.rejects(loginAccount(client,form),/Confirm your email/);
});

test('login requires an authenticated user and session before succeeding',async()=>{
 for(const data of [null,{}, {user:{id:'u1'}}, {session:{access_token:'test'}}]) {
  const client={auth:{signInWithPassword:async()=>({data,error:null})}};
  await assert.rejects(loginAccount(client,form),/Login could not be completed/);
 }
});

test('empty login fields are rejected without contacting the account service',async()=>{
 let called=false;
 const client={auth:{signInWithPassword:async()=>{called=true;}}};
 await assert.rejects(loginAccount(client,{email:'invalid',password:form.password}),/valid email/);
 await assert.rejects(loginAccount(client,{email:form.email,password:''}),/Enter your password/);
 assert.equal(called,false);
});
