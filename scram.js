/* CryptoJS core */
var CryptoJS = (function(Math) {
  var C = {};
  var C_lib = C.lib = {};
  var Base = C_lib.Base = (function() {
    function F() {}
    return {
      extend: function(overrides) {
        F.prototype = this;
        var subtype = new F();
        if (overrides) subtype.mixIn(overrides);
        if (!subtype.hasOwnProperty('init')) {
          subtype.init = function() { subtype.$super.init.apply(this, arguments); };
        }
        subtype.init.prototype = subtype;
        subtype.$super = this;
        return subtype;
      },
      create: function() {
        var instance = this.extend();
        instance.init.apply(instance, arguments);
        return instance;
      },
      init: function() {},
      mixIn: function(properties) {
        for (var name in properties) {
          if (properties.hasOwnProperty(name)) this[name] = properties[name];
        }
        if (properties.hasOwnProperty('toString')) this.toString = properties.toString;
      },
      clone: function() { return this.init.prototype.extend(this); }
    };
  }());

  var WordArray = C_lib.WordArray = Base.extend({
    init: function(words, sigBytes) {
      this.words = words || [];
      this.sigBytes = (sigBytes !== undefined) ? sigBytes : this.words.length * 4;
    },
    toString: function(enc) { return (enc || C_enc.Hex).stringify(this); },
    concat: function(wa) {
      var tw = this.words, ww = wa.words, ts = this.sigBytes, ws = wa.sigBytes;
      this.clamp();
      if (ts % 4) {
        for (var i = 0; i < ws; i++) {
          var b = ww[i>>>2] >>> (24 - (i%4)*8) & 0xff;
          tw[(ts+i)>>>2] |= b << (24 - ((ts+i)%4)*8);
        }
      } else {
        for (var i = 0; i < ws; i += 4) tw[(ts+i)>>>2] = ww[i>>>2];
      }
      this.sigBytes += ws;
      return this;
    },
    clamp: function() {
      var w = this.words, s = this.sigBytes;
      w[s>>>2] &= 0xffffffff << (32 - (s%4)*8);
      w.length = Math.ceil(s/4);
    },
    clone: function() {
      var c = Base.clone.call(this);
      c.words = this.words.slice(0);
      return c;
    },
    random: function(n) {
      var w = [];
      for (var i = 0; i < n; i += 4) w.push(Math.random() * 0x100000000 | 0);
      return this.create(w, n);
    }
  });

  var C_enc = C.enc = {};
  C_enc.Hex = {
    stringify: function(wa) {
      var w = wa.words, s = wa.sigBytes, h = [];
      for (var i = 0; i < s; i++) {
        var b = w[i>>>2] >>> (24 - (i%4)*8) & 0xff;
        h.push((b>>>4).toString(16), (b&0xf).toString(16));
      }
      return h.join('');
    },
    parse: function(hex) {
      var l = hex.length, w = [];
      for (var i = 0; i < l; i += 2) w[i>>>3] |= parseInt(hex.substr(i,2),16) << (24 - (i%8)*4);
      return WordArray.create(w, l/2);
    }
  };
  var Latin1 = C_enc.Latin1 = {
    stringify: function(wa) {
      var w = wa.words, s = wa.sigBytes, c = [];
      for (var i = 0; i < s; i++) c.push(String.fromCharCode(w[i>>>2] >>> (24-(i%4)*8) & 0xff));
      return c.join('');
    },
    parse: function(s) {
      var l = s.length, w = [];
      for (var i = 0; i < l; i++) w[i>>>2] |= (s.charCodeAt(i) & 0xff) << (24 - (i%4)*8);
      return WordArray.create(w, l);
    }
  };
  var Utf8 = C_enc.Utf8 = {
    stringify: function(wa) {
      try { return decodeURIComponent(escape(Latin1.stringify(wa))); }
      catch(e) { throw new Error('Malformed UTF-8 data'); }
    },
    parse: function(s) { return Latin1.parse(unescape(encodeURIComponent(s))); }
  };

  var BBA = C_lib.BufferedBlockAlgorithm = Base.extend({
    reset: function() { this._data = WordArray.create(); this._nDataBytes = 0; },
    _append: function(data) {
      if (typeof data === 'string') data = Utf8.parse(data);
      this._data.concat(data);
      this._nDataBytes += data.sigBytes;
    },
    _process: function(flush) {
      var data = this._data, dw = data.words, ds = data.sigBytes;
      var bs = this.blockSize, bsb = bs * 4;
      var nr = ds / bsb;
      nr = flush ? Math.ceil(nr) : Math.max((nr|0) - this._minBufferSize, 0);
      var nw = nr * bs, nb = Math.min(nw*4, ds);
      if (nw) {
        for (var o = 0; o < nw; o += bs) this._doProcessBlock(dw, o);
        var pw = dw.splice(0, nw);
        data.sigBytes -= nb;
      }
      return WordArray.create(pw, nb);
    },
    clone: function() { var c = Base.clone.call(this); c._data = this._data.clone(); return c; },
    _minBufferSize: 0
  });

  var Hasher = C_lib.Hasher = BBA.extend({
    cfg: Base.extend(),
    init: function(cfg) { this.cfg = this.cfg.extend(cfg); this.reset(); },
    reset: function() { BBA.reset.call(this); this._doReset(); },
    update: function(msg) { this._append(msg); this._process(); return this; },
    finalize: function(msg) { if (msg) this._append(msg); return this._doFinalize(); },
    blockSize: 512/32,
    _createHelper: function(h) { return function(msg,cfg){ return new h.init(cfg).finalize(msg); }; },
    _createHmacHelper: function(h) { return function(msg,key){ return new C_algo.HMAC.init(h,key).finalize(msg); }; }
  });

  var C_algo = C.algo = {};
  return C;
}(Math));

/* SHA256 */
(function(){
  var C=CryptoJS,WA=C.lib.WordArray,H=C.lib.Hasher,algo=C.algo;
  var Hi=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var Ki=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var W=[];
  algo.SHA256=H.extend({
    _doReset:function(){this._hash=WA.create(Hi.slice(0));},
    _doProcessBlock:function(M,o){
      var hw=this._hash.words;
      var a=hw[0],b=hw[1],c=hw[2],d=hw[3],e=hw[4],f=hw[5],g=hw[6],h=hw[7];
      for(var i=0;i<64;i++){
        if(i<16){W[i]=M[o+i]|0;}
        else{
          var g0x=W[i-15],g1x=W[i-2];
          var g0=(g0x<<25|g0x>>>7)^(g0x<<14|g0x>>>18)^(g0x>>>3);
          var g1=(g1x<<15|g1x>>>17)^(g1x<<13|g1x>>>19)^(g1x>>>10);
          W[i]=g0+W[i-7]+g1+W[i-16];
        }
        var ch=(e&f)^(~e&g);
        var maj=(a&b)^(a&c)^(b&c);
        var s0=(a<<30|a>>>2)^(a<<19|a>>>13)^(a<<10|a>>>22);
        var s1=(e<<26|e>>>6)^(e<<21|e>>>11)^(e<<7|e>>>25);
        var t1=h+s1+ch+Ki[i]+W[i];
        var t2=s0+maj;
        h=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
      }
      hw[0]=(hw[0]+a)|0;hw[1]=(hw[1]+b)|0;hw[2]=(hw[2]+c)|0;hw[3]=(hw[3]+d)|0;
      hw[4]=(hw[4]+e)|0;hw[5]=(hw[5]+f)|0;hw[6]=(hw[6]+g)|0;hw[7]=(hw[7]+h)|0;
    },
    _doFinalize:function(){
      var d=this._data,w=d.words,nb=this._nDataBytes*8,nl=d.sigBytes*8;
      w[nl>>>5]|=0x80<<(24-nl%32);
      w[(((nl+64)>>>9)<<4)+14]=Math.floor(nb/0x100000000);
      w[(((nl+64)>>>9)<<4)+15]=nb;
      d.sigBytes=w.length*4;
      this._process();
      return this._hash;
    },
    clone:function(){var c=H.clone.call(this);c._hash=this._hash.clone();return c;}
  });
  C.SHA256=H._createHelper(algo.SHA256);
  C.HmacSHA256=H._createHmacHelper(algo.SHA256);
})();

/* HMAC */
(function(){
  var C=CryptoJS,Base=C.lib.Base,Utf8=C.enc.Utf8;
  C.algo.HMAC=Base.extend({
    init:function(hasher,key){
      this._hasher=new hasher.init();
      if(typeof key==='string') key=Utf8.parse(key);
      var bs=this._hasher.blockSize, bsb=bs*4;
      if(key.sigBytes>bsb) key=this._hasher.finalize(key);
      key.clamp();
      // Pad key to blockSize
      var oKey=this._oKey=key.clone();
      var iKey=this._iKey=key.clone();
      oKey.sigBytes=bsb; iKey.sigBytes=bsb;
      // Ensure words array is large enough
      while(oKey.words.length<bs) oKey.words.push(0);
      while(iKey.words.length<bs) iKey.words.push(0);
      var ok=oKey.words, ik=iKey.words;
      for(var i=0;i<bs;i++){ok[i]^=0x5c5c5c5c;ik[i]^=0x36363636;}
      this._hasher.reset();
      this._hasher.update(this._iKey);
    },
    update:function(msg){this._hasher.update(msg);return this;},
    finalize:function(msg){
      var h=this._hasher;
      var inner=h.finalize(msg);
      h.reset();
      return h.finalize(this._oKey.clone().concat(inner));
    },
    reset:function(){
      this._hasher.reset();
      this._hasher.update(this._iKey);
    }
  });
})();

/* PBKDF2 */
(function(){
  var C=CryptoJS,Base=C.lib.Base,WA=C.lib.WordArray,algo=C.algo,HMAC=algo.HMAC;
  algo.PBKDF2=Base.extend({
    cfg:Base.extend({keySize:4,hasher:algo.SHA256,iterations:1}),
    init:function(cfg){this.cfg=this.cfg.extend(cfg);},
    compute:function(password,salt){
      var cfg=this.cfg;
      var hmac=HMAC.create(cfg.hasher,password);
      var dk=WA.create();
      var bi=WA.create([0x00000001]);
      var dkw=dk.words, biw=bi.words;
      var ks=cfg.keySize, it=cfg.iterations;
      while(dkw.length<ks){
        var block=hmac.update(salt).finalize(bi);
        hmac.reset();
        var bw=block.words, bl=bw.length;
        var U=block;
        for(var i=1;i<it;i++){
          U=hmac.finalize(U);
          hmac.reset();
          var uw=U.words;
          for(var j=0;j<bl;j++) bw[j]^=uw[j];
        }
        dk.concat(block);
        biw[0]++;
      }
      dk.sigBytes=ks*4;
      return dk;
    }
  });
  C.PBKDF2=function(pw,salt,cfg){return algo.PBKDF2.create(cfg).compute(pw,salt);};
})();

/* SCRAMJS v1.0.1 - Huawei Technologies */
(function(){
  var C=CryptoJS, Base=C.lib.Base, SHA2=C.algo.SHA256, HmacSHA2=C.HmacSHA256, lastNonce;
  var SCRAM=C.algo.SCRAM=Base.extend({
    cfg:Base.extend({keySize:8,hasher:SHA2,hmac:HmacSHA2}),
    init:function(cfg){this.cfg=this.cfg.extend(cfg);},
    nonce:function(){lastNonce=C.lib.WordArray.random(this.cfg.keySize*4);return lastNonce;},
    saltedPassword:function(pw,salt,iter){return C.PBKDF2(pw,salt,{keySize:this.cfg.keySize,iterations:parseInt(iter),hasher:this.cfg.hasher});},
    clientKey:function(spwd){return this.cfg.hmac(spwd,'Client Key');},
    serverKey:function(spwd){return this.cfg.hmac(spwd,'Server Key');},
    storedKey:function(ck){var h=this.cfg.hasher.create();h.update(ck);return h.finalize();},
    signature:function(sk,msg){return this.cfg.hmac(sk,msg);},
    clientProof:function(pw,salt,iter,msg){
      var spwd=this.saltedPassword(pw,salt,iter);
      var ck=this.clientKey(spwd);
      var sk=this.storedKey(ck);
      var cs=this.signature(sk,msg);
      for(var i=0;i<ck.sigBytes/4;i++) ck.words[i]^=cs.words[i];
      return ck;
    }
  });
  C.SCRAM=function(cfg){return SCRAM.create(cfg);};
}());
