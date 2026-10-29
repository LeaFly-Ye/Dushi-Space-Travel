(() => {
  'use strict';

  /* =========================================================
     星海笃行 · Dushi Starfarer
     A self-contained canvas bullet-hell for Dushi College.
     ========================================================= */

  const CLASS_NAME = '笃实书院 · 64班';
  const TAU = Math.PI * 2;
  // 三档难度共用的基础结构值（战机 hpMod 会在此基础上增减）。
  const BASE_STRUCTURE = 3;
  const STORAGE_PREFIX = 'dushi-starfarer.';
  // Combat-only pulse gains (passive, graze and kills) are tuned down; explicit
  // pickup / layer rewards keep their advertised percentages.
  const PULSE_GAIN_MULT = 0.7;

  // 波次与 Boss 节奏。延长波次间隔并整体后移 Boss 出现时间。
  const CAMPAIGN_BOSS_WAVE = 61;
  const MIDBOSS_WAVE = 31;
  const CAMPAIGN_BOSS_TIME = 150;
  const ENDLESS_FIRST_BOSS_TIME = 100;
  const ENDLESS_BOSS_INTERVAL = 80;
  const STAGE2_TIME = 45;
  const STAGE3_TIME = 100;

  // 三档难度共用同一套机体、敌机与 Boss 数值；差异只体现在弹幕编排上。
  // tier: 0 = 单发点射 / 1 = 等差三连 / 2 = 等差五连，所有子弹基准速度一致。
  const DIFFICULTIES = {
    easy: {
      key: 'easy', label: '轻松', grade: '观星者', tier: 0,
      shotNote: '单发点射', densityNote: '稀疏弹幕', scoreMul: 0.9
    },
    normal: {
      key: 'normal', label: '标准', grade: '领航员', tier: 1,
      shotNote: '等差三连', densityNote: '标准密度', scoreMul: 1
    },
    hard: {
      key: 'hard', label: '困难', grade: '破界者', tier: 2,
      shotNote: '等差五连', densityNote: '密集弹幕', scoreMul: 1.25
    }
  };

  // 8 / 10 / 12 层是环形弹、旋臂弹与叠层弹幕的基础层数；
  // 标准与困难额外给每层一个角度偏移，让弹幕形成扇面而不是同心直线。
  const ENEMY_LAYER_COUNT = [5, 7, 9];
  const BOSS_LAYER_COUNT = [6, 8, 10];
  const LAYER_ANGLE_STEP = [0, 0.035, 0.05];
  // 观测者精英暂时隐藏；代码与绘制保留，便于之后恢复。
  const ELITE_ENABLED = false;
  // 测试用清场作弊键 Q；暂时停用，需要时改回 true。
  const CHEAT_CLEAR_ENABLED = false;

  // 出怪权重表（参考植物大战僵尸的波次预算）：
  // weight 越高越容易被选中；cost 越高越占用本波威胁预算；
  // high 单位每波最多 1 只、同屏最多 2 只，并带冷却与保底。
  const SPAWN_TABLE = {
    drone:    { weight: 18, cost: 1.2, pack: 3, maxWave: 3, minTime: 0,  high: false },
    weaver:   { weight: 18, cost: 2.4, pack: 2, maxWave: 2, minTime: 12, high: false },
    lancer:   { weight: 14, cost: 1.1, pack: 2, maxWave: 4, minTime: 12, high: false },
    turret:   { weight: 52, cost: 4.5, pack: 1, maxWave: 2, minTime: 18, high: true, cooldown: 9 },
    sentinel: { weight: 58, cost: 4.5, pack: 1, maxWave: 2, minTime: 18, high: true, cooldown: 9 },
    carrier:  { weight: 52, cost: 6.0, pack: 1, maxWave: 1, minTime: 24, high: true, cooldown: 12 }
  };
  const HIGH_THREAT_PITY = 15;
  // 守点类敌机的最大停留时间；到时不再开火，改为向下退场。
  const ENEMY_LEAVE_TIME = {
    drone: 14, weaver: 16, lancer: 10,
    turret: 14, sentinel: 16, carrier: 22, elite: 20
  };

  const DISCIPLINES = {
    aero: {
      key: 'aero', label: '航空航天', file: '航天档案', pickup: '航天徽章',
      color: '#f5c96b', gain: '火力系统'
    },
    code: {
      key: 'code', label: '软件学院', file: '代码档案', pickup: '算法徽章',
      color: '#67e8f9', gain: '算法护盾'
    },
    ie: {
      key: 'ie', label: '工业工程系', file: '效率档案', pickup: '效率徽章',
      color: '#a78bfa', gain: '机动效率'
    }
  };

  const KNOWLEDGE = {
    aero: [
      { title: '第一宇宙速度', text: '约 7.9 km/s。它是贴近地球表面做圆周运动所需的速度，也是航天器“绕起来”的门槛。' },
      { title: '真空中的推力', text: '火箭不靠空气反作用，而靠高速喷出自身携带的推进剂获得反作用力，因此能在真空中工作。' },
      { title: '霍曼转移', text: '在两条共面圆轨道之间切换时，两次切向加速或减速可以拼出一条椭圆转移轨道，是经典的省燃料方案。' },
      { title: '再入走廊', text: '返回舱再入角度过陡会过热，过浅又可能被大气“弹”回太空；合适的再入走廊是一道窄门。' },
      { title: '动量轮', text: '卫星常用高速转动的动量轮交换角动量来改变姿态，不必每次都消耗推进剂。' },
      { title: '液氢液氧', text: '液氢/液氧发动机比冲高，燃烧产物主要是水蒸气，是上面级与重型火箭的常见组合。' },
      { title: '比冲', text: '比冲衡量发动机“每单位推进剂产生多少冲量”，工程中常以秒为单位，数值越高越省推进剂。' },
      { title: '近地轨道', text: '中国空间站运行在约 400 km 的近地轨道，大约每 90 分钟绕地球一圈。' },
      { title: '逃逸速度', text: '约 11.2 km/s。航天器要彻底脱离地球引力，需要达到比近地轨道环绕速度更高的速度。' },
      { title: '拉格朗日点', text: '两大天体引力与离心效应平衡的位置。L1/L2 适合观测与中继，但轨道不稳定，需要定期修正。' },
      { title: '火箭方程', text: '齐奥尔科夫斯基公式表明速度增量取决于排气速度与质量比；减重与提高比冲同样重要。' },
      { title: '垂直回收', text: '可重复使用火箭通过反推、栅格舵与着陆腿垂直回收，降低单位入轨成本，但需预留推进剂。' }
    ],
    code: [
      { title: '快速排序', text: '平均时间复杂度为 O(n log n)，最坏情况 O(n²)。随机化枢轴能让最坏情况几乎不出现。' },
      { title: '三次握手', text: 'TCP 建立连接需要 SYN、SYN-ACK、ACK 三次交换，双方借此确认收发能力与初始序列号。' },
      { title: '哈希表', text: '哈希表平均查找 O(1)，但冲突处理与装载因子决定了它的实际性能；最坏可退化为 O(n)。' },
      { title: '缓存局部性', text: '程序倾向于访问刚用过的数据与相邻地址。好的遍历顺序能让缓存命中率显著提升。' },
      { title: '浮点数', text: '在 IEEE 754 双精度中，0.1 + 0.2 并不精确等于 0.3，而是 0.30000000000000004。' },
      { title: '高内聚低耦合', text: '模块内部职责越集中、模块之间依赖越少，软件越容易测试、复用与演进。' },
      { title: '二分查找', text: '二分查找的 O(log n) 建立在有序数据与随机访问之上；每次比较都能排除一半候选区间。' },
      { title: '幂等性', text: '幂等操作执行一次与多次的结果相同。支付、消息重试等场景常借助幂等键避免重复副作用。' },
      { title: 'CAP 定理', text: '分布式系统无法同时保证一致性、可用性与分区容忍性，网络分区时必须在一致性与可用性间取舍。' },
      { title: 'B+ 树索引', text: '数据库常用 B+ 树组织磁盘索引：矮胖、有序、叶节点相连，能用较少 I/O 完成范围查询。' },
      { title: 'Raft 共识', text: 'Raft 通过领导者选举、日志复制与任期编号维护一致性，把复杂共识拆成更易理解的模块。' },
      { title: 'Git 快照', text: 'Git 保存提交快照而非逐行差异；分支只是指向提交的可移动指针，因此创建和切换非常轻量。' }
    ],
    ie: [
      { title: '工业工程的对象', text: '工业工程把人、物料、信息、设备与能量视为一个整体系统，追求效率、质量与体验的平衡。' },
      { title: '六西格玛', text: '六西格玛以数据驱动减少过程波动，长期质量目标常被表述为每百万机会不超过 3.4 个缺陷。' },
      { title: '排队论', text: '当服务能力接近满负荷时，平均等待时间会非线性上升；留出缓冲往往比“拉满”更高效。' },
      { title: '人因工程', text: '人因工程研究人的能力与限制，让界面、工位与流程适配人，而不是让人去适配系统。' },
      { title: '甘特图', text: '甘特图把任务、时间与依赖关系放在同一条时间轴上，是项目进度沟通的经典工具。' },
      { title: '动作研究', text: '弗兰克与莉莲·吉尔布雷斯通过分解动作、消除浪费来提升作业效率，也推动了人因工程的发展。' },
      { title: '经济订货批量', text: 'EOQ 模型在订货成本与持有成本之间取平衡；订货太频繁或库存太多都不是最优解。' },
      { title: '系统布置设计', text: 'SLP 用物流关系与活动关系来安排设施位置，目标是在有限空间里减少搬运与等待。' },
      { title: '精益生产', text: '精益生产以消除浪费为核心，用看板、拉动式补货与持续改善缩短周期，而不只是提高单机速度。' },
      { title: '关键路径', text: '关键路径是项目网络中最长的依赖链，决定最短工期；压缩关键路径上的任务才可能提前完工。' },
      { title: '库存周转', text: '库存周转率反映一段时间内库存被消耗的次数；周转过低占用现金，过高则增加缺货风险。' },
      { title: '动作经济', text: '动作经济原则通过减少多余移动、调整工位高度与工具位置，降低疲劳并缩短作业周期。' }
    ]
  };

  const SHIP_SVGS = {
    dushi: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 38 25 55 34 46 43 36 37 34 53 32 48 30 53 28 37 18 43 9 34 26 25Z" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M32 12v26M26 33l-7 6M38 33l7 6" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".8"/><ellipse cx="32" cy="24" rx="2.6" ry="6" fill="var(--ship-accent,#67e8f9)"/></svg>`,
    xinghuo: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 36 25 50 31 40 38 35 51 32 44 29 51 24 38 14 31 28 25Z" fill="currentColor" opacity=".18" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M32 12v26M23 39l-6-4M41 39l6-4" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".8"/><circle cx="32" cy="23" r="2.5" fill="var(--ship-accent,#fb923c)"/></svg>`,
    changcheng: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8 39 20 58 26 55 40 42 41 37 51 32 46 27 51 22 41 9 40 6 26 25 20Z" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M22 34h20M25 40h14M32 14v24" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".75"/><rect x="29" y="21" width="6" height="10" rx="2" fill="var(--ship-accent,#f5c96b)"/></svg>`,
    tianwen: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 38 21 50 25 55 37 45 45 36 42 33 53 32 47 31 53 28 42 19 45 9 37 14 25 26 21Z" fill="currentColor" opacity=".17" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="32" cy="29" r="10" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".8"/><circle cx="32" cy="29" r="4" fill="var(--ship-accent,#c4b5fd)"/><path d="M32 19v-7M22 29h-7M42 29h7" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".55"/></svg>`
  };

  // 三张符卡分别对应笃实书院的三系方向，名字呼应本局知识库中的三系概念。
  const SPELL_CARDS = [
    { name: '航天「逃逸速度」', sub: '吸收星环 · 大星弹反击' },
    { name: '软件「人月神话」', sub: '加速旋臂 · 短暂休息环' },
    { name: '工业「流水线节拍」', sub: '三向齐射 · 齿轮追击' }
  ];
  const PHASE_NAMES = SPELL_CARDS.map(card => card.name);
  const PHASE_COLORS = ['#f5c96b', '#67e8f9', '#c4b5fd'];
  const BGM_TRACKS = {
    menu: {
      title: '宇宙巫女帰還する',
      artist: 'MiracleMirinaeMirage',
      volume: 0.48,
      sources: ['assets/audio/menu.mp3']
    },
    normal: {
      title: '遥か３８万キロのボヤージュ',
      artist: 'MiracleMirinaeMirage',
      volume: 0.52,
      sources: ['assets/audio/normal.mp3']
    },
    boss: {
      title: 'パンデモニックプラネット',
      artist: 'MiracleMirinaeMirage',
      volume: 0.60,
      sources: ['assets/audio/boss.mp3']
    }
  };
  // Boss 的弹速、发射间隔与血量在三档难度下完全一致，只增减弹量、臂数与安全缺口。
  const BOSS_TUNING = {
    easy: {
      ringCount: 8, spiralArms: 2
    },
    normal: {
      ringCount: 10, spiralArms: 4
    },
    hard: {
      ringCount: 12, spiralArms: 6
    }
  };

  const SHIP_ORDER = ['dushi', 'xinghuo', 'changcheng', 'tianwen'];
  const SHIPS = {
    dushi: {
      key: 'dushi', name: '笃实号', role: '均衡', en: 'DUSHI',
      desc: '追踪型僚机与均衡护盾，适合第一次出航。',
      hpMod: 0, speed: 0.5, fireRate: 1, damage: 0.8, hitbox: 1,
      shieldMax: 3, startShield: 0, wingmanStyle: 'homing',
      stroke: '#d9d0ff', body: '#17122f', accent: '#67e8f9', bullet: '#a5f3fc', secondary: '#c4b5fd',
      stats: { fire: 3, armor: 3, shield: 3 }
    },
    xinghuo: {
      key: 'xinghuo', name: '星火号', role: '突击', en: 'SPARK',
      desc: '更小判定点与集中型直线僚机，机体轻巧。',
      hpMod: 0, speed: 0.5, fireRate: 1, damage: 1.10, hitbox: 0.86,
      shieldMax: 2, startShield: 0, wingmanStyle: 'focus',
      stroke: '#fbbf24', body: '#241708', accent: '#fb923c', bullet: '#fde68a', secondary: '#fb923c',
      stats: { fire: 3, armor: 2, shield: 2 }
    },
    changcheng: {
      key: 'changcheng', name: '长城号', role: '重装', en: 'BULWARK',
      desc: '额外结构与集中型直线僚机，适合正面推进。',
      hpMod: 1, speed: 0.5, fireRate: 1, damage: 1, hitbox: 1.14,
      shieldMax: 2, startShield: 0, wingmanStyle: 'focus',
      stroke: '#c4b5fd', body: '#191333', accent: '#f5c96b', bullet: '#f5c96b', secondary: '#c4b5fd',
      stats: { fire: 3, armor: 5, shield: 2 }
    },
    tianwen: {
      key: 'tianwen', name: '天问号', role: '技术', en: 'TIANWEN',
      desc: '大范围直线僚机与厚护盾，适合稳健控场。',
      hpMod: 0, speed: 0.5, fireRate: 1, damage: 1, hitbox: 0.95,
      shieldMax: 4, startShield: 1, wingmanStyle: 'wide',
      stroke: '#a5f3fc', body: '#0e2030', accent: '#c4b5fd', bullet: '#67e8f9', secondary: '#a5f3fc',
      stats: { fire: 4, armor: 3, shield: 5 }
    }
  };

  /* ---------- tiny helpers ---------- */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const dist2 = (ax, ay, bx, by) => {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  const pad2 = n => String(Math.max(0, Math.floor(n))).padStart(2, '0');
  const fmtScore = n => String(Math.max(0, Math.floor(n))).padStart(6, '0');
  const fmtTime = s => `${pad2(s / 60)}:${pad2(s % 60)}`;
  const fmtNum = n => Math.floor(n).toLocaleString('zh-CN');

  function safeGet(key, fallback) {
    try {
      const v = localStorage.getItem(STORAGE_PREFIX + key);
      return v === null ? fallback : v;
    } catch (_) { return fallback; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(STORAGE_PREFIX + key, String(value)); } catch (_) { /* private mode */ }
  }

  /* ---------- audio ---------- */
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.noiseBuffer = null;
      this.muted = safeGet('muted', 'false') === 'true';
      this.lastShot = 0;
      this.lastExplode = 0;
      this.paused = false;
      this.bgmEls = { menu: null, normal: null, boss: null };
      this.bgmStatus = { menu: 'idle', normal: 'idle', boss: 'idle' };
      this.bgmSourceIndex = { menu: 0, normal: 0, boss: 0 };
      this.bgmMode = 'normal';
      this.usingExternal = false;
      this.wantMusic = false;
      this.externalFadeTimer = null;
      // 本地 file:// 或严格的自动播放策略可能先拒绝一次 play()；
      // 保留元素并在下一次用户手势时重试，而不是永久关闭 BGM。
      this.bgmBlocked = false;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      try {
        this.ctx = new Ctx();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.knee.value = 18;
        comp.ratio.value = 4;
        comp.attack.value = 0.006;
        comp.release.value = 0.3;
        comp.connect(this.ctx.destination);
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.52;
        this.master.connect(comp);

        const len = Math.floor(this.ctx.sampleRate * 1.2);
        const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buffer;
      } catch (_) {
        this.ctx = null;
      }
    }

    startBgm(mode = 'menu') {
      if (!BGM_TRACKS[mode]) mode = 'menu';
      this.wantMusic = true;
      this.bgmMode = mode;
      this.setupExternalBgm();
      if (this.usingExternal) {
        this.setBgmMode(mode);
        return;
      }
      if (this.bothExternalReady()) {
        this.beginExternalBgm(mode);
      }
    }

    // 在每次点击 / 按键 / 页面重新可见时调用：若 BGM 曾被自动播放策略拒绝，
    // 这里会在真实用户手势中重试，而不是让音乐永久静音。
    unlockBgm() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        try { this.ctx.resume(); } catch (_) { /* ignore */ }
      }
      if (!this.wantMusic) return;
      if (!this.bgmEls[this.bgmMode]) {
        this.setupExternalBgm();
        return;
      }
      if (!this.usingExternal) {
        if (this.bothExternalReady()) this.beginExternalBgm(this.bgmMode);
        return;
      }
      const active = this.bgmEls[this.bgmMode];
      if (!active) return;
      if (!active.paused) {
        this.bgmBlocked = false;
        const target = BGM_TRACKS[this.bgmMode].volume * (this.paused ? 0.16 : 1);
        if (Math.abs(active.volume - target) > 0.005) this.fadeExternalBgm(true);
        return;
      }
      active.muted = this.muted;
      active.volume = BGM_TRACKS[this.bgmMode].volume * (this.paused ? 0.16 : 1);
      const promise = active.play();
      if (promise && promise.then) {
        promise.then(() => {
          this.bgmBlocked = false;
          this.fadeExternalBgm(true);
        }).catch(() => {
          this.bgmBlocked = true;
        });
      } else {
        this.bgmBlocked = false;
        this.fadeExternalBgm(true);
      }
    }

    setupExternalBgm() {
      if (this.bgmEls.normal) return;
      for (const key of Object.keys(BGM_TRACKS)) {
        const audioEl = new Audio();
        audioEl.loop = true;
        audioEl.preload = 'auto';
        audioEl.volume = 0;
        audioEl.playsInline = true;
        audioEl.muted = this.muted;
        audioEl.dataset.bgm = key;
        const loadSource = idx => {
          const sources = BGM_TRACKS[key].sources;
          if (idx >= sources.length) {
            this.bgmStatus[key] = 'error';
            return;
          }
          this.bgmSourceIndex[key] = idx;
          audioEl.src = sources[idx];
          audioEl.load();
        };
        audioEl.addEventListener('canplay', () => {
          this.bgmStatus[key] = 'ready';
          if (this.wantMusic && this.bothExternalReady() && !this.usingExternal && !this.paused) {
            this.beginExternalBgm(this.bgmMode);
          }
        });
        audioEl.addEventListener('error', () => {
          if (this.bgmStatus[key] === 'ready') return;
          loadSource(this.bgmSourceIndex[key] + 1);
        });
        this.bgmEls[key] = audioEl;
        this.bgmStatus[key] = 'loading';
        loadSource(0);
      }
    }

    bothExternalReady() {
      return this.bgmStatus.menu === 'ready'
        && this.bgmStatus.normal === 'ready'
        && this.bgmStatus.boss === 'ready';
    }

    beginExternalBgm(mode) {
      if (!this.bothExternalReady()) return false;
      const active = this.bgmEls[mode];
      if (!active) return false;
      this.usingExternal = true;
      this.bgmMode = mode;
      for (const key of Object.keys(this.bgmEls)) {
        const el = this.bgmEls[key];
        el.muted = this.muted;
        el.volume = 0;
        if (key === mode) {
          const wasMuted = el.muted;
          el.muted = true;
          const promise = el.play();
          if (promise && promise.then) {
            promise.then(() => {
              el.muted = wasMuted;
              this.bgmBlocked = false;
              this.fadeExternalBgm(true);
            }).catch(() => {
              // 首次自动播放可能被拦截；保持 usingExternal，等用户手势重试。
              this.bgmBlocked = true;
            });
          } else {
            el.muted = wasMuted;
            this.bgmBlocked = false;
            this.fadeExternalBgm(true);
          }
        } else {
          el.pause();
        }
      }
      return true;
    }

    setBgmMode(mode) {
      if (!BGM_TRACKS[mode]) mode = 'normal';
      this.bgmMode = mode;
      if (this.usingExternal) {
        const active = this.bgmEls[mode];
        if (active) {
          active.muted = this.muted;
          const promise = active.play();
          if (promise && promise.then) {
            promise.then(() => { this.bgmBlocked = false; })
              .catch(() => { this.bgmBlocked = true; });
          } else {
            this.bgmBlocked = false;
          }
        }
        this.fadeExternalBgm(true);
        for (const key of Object.keys(this.bgmEls)) {
          if (key !== mode) {
            const el = this.bgmEls[key];
            setTimeout(() => {
              if (this.bgmMode !== key) el.pause();
            }, 900);
          }
        }
      } else if (this.wantMusic && this.bothExternalReady() && !this.paused) {
        this.beginExternalBgm(mode);
      }
    }

    fadeExternalBgm(animate = true) {
      if (!this.usingExternal) return;
      const startTime = performance.now();
      const from = {};
      const to = {};
      for (const key of Object.keys(this.bgmEls)) {
        const el = this.bgmEls[key];
        from[key] = el.volume;
        to[key] = key === this.bgmMode
          ? BGM_TRACKS[key].volume * (this.paused ? 0.16 : 1)
          : 0;
        el.muted = this.muted;
      }
      if (!animate) {
        for (const key of Object.keys(this.bgmEls)) this.bgmEls[key].volume = to[key];
        return;
      }
      clearInterval(this.externalFadeTimer);
      const duration = 800;
      this.externalFadeTimer = setInterval(() => {
        const k = clamp((performance.now() - startTime) / duration, 0, 1);
        const ease = 1 - Math.pow(1 - k, 3);
        for (const key of Object.keys(this.bgmEls)) {
          this.bgmEls[key].volume = clamp(lerp(from[key], to[key], ease), 0, 1);
        }
        if (k >= 1) {
          clearInterval(this.externalFadeTimer);
          this.externalFadeTimer = null;
        }
      }, 30);
    }

    stopExternalBgm() {
      this.usingExternal = false;
      clearInterval(this.externalFadeTimer);
      this.externalFadeTimer = null;
      for (const key of Object.keys(this.bgmEls)) {
        const el = this.bgmEls[key];
        if (!el) continue;
        el.pause();
        el.volume = 0;
      }
    }

    getAudioState() {
      return {
        ready: !!this.ctx,
        state: this.ctx ? this.ctx.state : 'none',
        bgm: this.usingExternal,
        external: this.usingExternal,
        bgmBlocked: this.bgmBlocked,
        externalStatus: {
          menu: this.bgmStatus.menu,
          normal: this.bgmStatus.normal,
          boss: this.bgmStatus.boss
        },
        mode: this.bgmMode,
        externalVolumes: {
          menu: this.bgmEls.menu ? +this.bgmEls.menu.volume.toFixed(3) : null,
          normal: this.bgmEls.normal ? +this.bgmEls.normal.volume.toFixed(3) : null,
          boss: this.bgmEls.boss ? +this.bgmEls.boss.volume.toFixed(3) : null
        },
        externalTime: {
          menu: this.bgmEls.menu ? +this.bgmEls.menu.currentTime.toFixed(2) : null,
          normal: this.bgmEls.normal ? +this.bgmEls.normal.currentTime.toFixed(2) : null,
          boss: this.bgmEls.boss ? +this.bgmEls.boss.currentTime.toFixed(2) : null
        },
        externalPaused: {
          menu: this.bgmEls.menu ? this.bgmEls.menu.paused : null,
          normal: this.bgmEls.normal ? this.bgmEls.normal.paused : null,
          boss: this.bgmEls.boss ? this.bgmEls.boss.paused : null
        },
        muted: this.muted
      };
    }

    setMuted(muted) {
      this.muted = muted;
      safeSet('muted', muted);
      for (const key of Object.keys(this.bgmEls)) {
        if (this.bgmEls[key]) this.bgmEls[key].muted = muted;
      }
      if (!this.ctx || !this.master) return;
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.52, t, 0.06);
    }

    suspendForPause(paused) {
      this.paused = paused;
      if (this.usingExternal) {
        this.fadeExternalBgm(true);
      } else if (!paused && this.wantMusic && this.bothExternalReady()) {
        this.beginExternalBgm(this.bgmMode);
      }
    }

    tone(freq, dur, type = 'sine', vol = 0.07, slideTo = null, delay = 0) {
      if (!this.ctx || !this.master || this.muted) return;
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    }

    noise(dur = 0.2, vol = 0.08, cutoff = 1100, delay = 0) {
      if (!this.ctx || !this.master || !this.noiseBuffer || this.muted) return;
      const t = this.ctx.currentTime + delay;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(90, cutoff * 0.28), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.02);
    }

    shoot() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (now - this.lastShot < 0.075) return;
      this.lastShot = now;
      this.tone(820, 0.045, 'square', 0.014, 360);
    }

    enemyShoot() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (now - this.lastShot < 0.12) return;
      this.lastShot = now;
      this.tone(190, 0.08, 'sawtooth', 0.012, 120);
    }

    pickup(type) {
      if (!this.ctx) return;
      const notes = type === 'aero' ? [523.25, 659.25, 783.99]
        : type === 'code' ? [659.25, 880, 1046.5]
          : [440, 554.37, 659.25];
      notes.forEach((n, i) => this.tone(n, 0.16, 'sine', 0.04, n * 1.01, i * 0.055));
    }

    explode(big = false) {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      if (!big && now - this.lastExplode < 0.055) return;
      this.lastExplode = now;
      this.noise(big ? 0.75 : 0.24, big ? 0.19 : 0.065, big ? 1200 : 700);
      this.tone(big ? 70 : 115, big ? 0.6 : 0.16, 'sine', big ? 0.14 : 0.045, 34);
    }

    damage() {
      this.noise(0.3, 0.13, 640);
      this.tone(150, 0.25, 'sawtooth', 0.07, 55);
    }

    bomb() {
      if (!this.ctx) return;
      this.tone(70, 0.75, 'sine', 0.18, 620);
      this.tone(220, 0.7, 'triangle', 0.06, 880, 0.05);
      this.noise(0.9, 0.13, 1800);
    }

    warning() {
      if (!this.ctx) return;
      [0, 0.22, 0.44].forEach((d, i) => this.tone(i === 2 ? 440 : 330, 0.12, 'square', 0.045, 220, d));
      this.noise(0.6, 0.05, 500, 0.5);
    }

    victory() {
      if (!this.ctx) return;
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((n, i) => {
        this.tone(n, 0.55, 'sine', 0.06, n, i * 0.16);
        this.tone(n / 2, 0.6, 'triangle', 0.025, n / 2, i * 0.16);
      });
      this.noise(1.2, 0.035, 3200, 0.4);
    }

    fail() {
      if (!this.ctx) return;
      [220, 185, 146.8, 110].forEach((n, i) => this.tone(n, 0.4, 'triangle', 0.05, n * 0.82, i * 0.18));
    }
  }

  /* ---------- dom ---------- */
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const frame = $('frame');
  const ctx = canvas.getContext('2d');
  const audio = new AudioEngine();

  const el = {
    hud: $('hud'),
    title: $('screen-title'),
    pause: $('screen-pause'),
    result: $('screen-result'),
    score: $('score-value'),
    time: $('time-value'),
    diffPill: $('diff-pill'),
    hpText: $('hp-text'),
    hpPips: $('hp-pips'),
    shieldPips: $('shield-pips'),
    pips: { aero: $('pips-aero'), code: $('pips-code'), ie: $('pips-ie') },
    lvl: { aero: $('lvl-aero'), code: $('lvl-code'), ie: $('lvl-ie') },
    bomb: $('bomb-btn'),
    bombCharge: $('bomb-charge'),
    bossUi: $('boss-ui'),
    bossFill: $('boss-fill'),
    bossHp: $('boss-hp-text'),
    bossPhase: $('boss-phase'),
    bossTrack: document.querySelector('.boss-track'),
    bossBanner: $('boss-banner'),
    stageBanner: $('stage-banner'),
    stageKicker: $('stage-kicker'),
    stageTitle: $('stage-title'),
    stageSub: $('stage-sub'),
    knowledge: $('knowledge-card'),
    knowledgeDept: $('knowledge-dept'),
    knowledgeNum: $('knowledge-num'),
    knowledgeTitle: $('knowledge-title'),
    knowledgeText: $('knowledge-text'),
    knowledgeGain: $('knowledge-gain'),
    hint: $('hint'),
    flash: $('damage-flash'),
    sound: $('btn-sound'),
    pauseBtn: $('btn-pause'),
    best: $('best-score'),
    diffGrid: $('difficulty-grid'),
    modeSwitch: $('mode-switch'),
    modeNote: $('mode-note'),
    shipChip: $('btn-ship'),
    shipChipIcon: $('ship-chip-icon'),
    shipChipName: $('ship-chip-name'),
    shipChipRole: $('ship-chip-role'),
    screenShip: $('screen-ship'),
    shipGrid: $('ship-grid'),
    btnShipConfirm: $('btn-ship-confirm'),
    btnShipClose: $('btn-ship-close'),
    resultShip: $('result-ship'),
    launch: $('btn-launch'),
    launchLabel: $('launch-label'),
    resultScore: $('result-score'),
    resultBest: $('result-best'),
    resultTitle: $('result-title'),
    resultStatus: $('result-status'),
    resultKicker: $('result-kicker'),
    resultSubtitle: $('result-subtitle'),
    statTime: $('stat-time'),
    statKills: $('stat-kills'),
    statPickups: $('stat-pickups'),
    statGraze: $('stat-graze'),
    statLayerCell: $('stat-layer-cell'),
    statLayer: $('stat-layer'),
    resultAero: $('result-aero'),
    resultCode: $('result-code'),
    resultIe: $('result-ie'),
    resultCert: $('result-cert'),
    resultKnowledge: $('result-knowledge'),
    resultKnowledgeList: $('result-knowledge-list'),
    resultKnowledgeCount: $('result-knowledge-count'),
    certLine: $('cert-line'),
    rotateTip: $('rotate-tip')
  };

  document.querySelectorAll('[data-class-name]').forEach(node => { node.textContent = CLASS_NAME; });
  const certOwner = $('cert-owner');
  if (certOwner) certOwner.textContent = CLASS_NAME;

  /* ---------- world state ---------- */
  let W = 0;
  let H = 0;
  let DPR = 1;
  let S = 1;
  let lastFrame = performance.now();
  let hudAccumulator = 0;
  let stageTimer = null;
  let bossBannerTimer = null;
  let knowledgeHideTimer = null;

  const game = {
    scene: 'title',
    phase: 'combat',
    paused: false,
    mode: 'campaign',
    difficulty: DIFFICULTIES.normal,
    shipKey: 'dushi',
    time: 0,
    score: 0,
    kills: 0,
    pickups: 0,
    graze: 0,
    bombCount: 0,
    cycle: 1,
    nextBossAt: CAMPAIGN_BOSS_TIME,
    midbossDone: false,
    nextEliteAt: 24,
    nextHighThreatAt: 24,
    lastHighThreatAt: 14,
    waveIndex: 0,
    waveBudget: 3,
    spawnCounts: {},
    carrierSeen: false,
    enemyScale: 1,
    enemyBulletScale: 1,
    player: null,
    boss: null,
    enemies: [],
    pBullets: [],
    eBullets: [],
    gearFormation: null,
    drops: [],
    particles: [],
    rings: [],
    floats: [],
    stars: [],
    portal: null,
    pointer: { active: false, id: null, sx: 0, sy: 0, px: 0, py: 0 },
    keys: new Set(),
    spawnT: 2.4,
    eliteT: 0,
    pickupT: 5,
    pickupCycle: 0,
    stage2: false,
    stage3: false,
    bossSpawned: false,
    shake: 0,
    flash: 0,
    slowT: 0,
    warp: 0,
    endT: 0,
    endWin: false,
    resultWin: false,
    knowledgeT: 0,
    hintT: 0,
    knowledgeCursor: { aero: 0, code: 0, ie: 0 },
    knowledgeDeck: { aero: [], code: [], ie: [] },
    knowledgeLog: [],
    lastHitSound: 0,
    timeScale: 1
  };

  /* ---------- canvas sizing / stars ---------- */
  function resize() {
    const rect = frame.getBoundingClientRect();
    W = Math.max(280, rect.width);
    H = Math.max(400, rect.height);
    DPR = Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    S = clamp(H / 820, 0.72, 1.24);

    if (game.player) {
      game.player.x = clamp(game.player.x, 18 * S, W - 18 * S);
      game.player.y = clamp(game.player.y, H * 0.16, H - 76 * S);
      game.player.tx = clamp(game.player.tx, 18 * S, W - 18 * S);
      game.player.ty = clamp(game.player.ty, H * 0.16, H - 76 * S);
    }
    if (game.boss) {
      game.boss.x = clamp(game.boss.x, 80 * S, W - 80 * S);
      game.boss.targetY = H * 0.285;
      if (!game.boss.entry) game.boss.y = game.boss.targetY;
    }
    if (game.portal) {
      game.portal.x = W * 0.5;
      game.portal.y = H * 0.16;
    }
    initStars();
    updateRotateTip();
  }

  function initStars() {
    const count = Math.round(clamp(W * H / 6200, 95, 210));
    game.stars = [];
    for (let i = 0; i < count; i++) {
      const z = Math.random();
      game.stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z,
        r: 0.35 + z * 1.35,
        a: 0.18 + z * 0.62,
        tw: Math.random() * TAU,
        sp: 18 + z * 105
      });
    }
  }

  function updateStars(dt) {
    const warp = game.warp;
    const speedBoost = 1 + warp * 7;
    for (const st of game.stars) {
      st.y += st.sp * dt * speedBoost;
      st.x -= (st.z * 5 + 2) * dt * (0.4 + warp);
      if (st.y > H + 8) {
        st.y = -8;
        st.x = Math.random() * W;
      }
      if (st.x < -8) st.x = W + 8;
      st.tw += dt * (0.4 + st.z);
    }
    game.warp = Math.max(0, game.warp - dt * 0.9);
  }

  function drawStars() {
    const warp = game.warp;
    for (const st of game.stars) {
      const alpha = st.a * (0.72 + Math.sin(st.tw * 1.8) * 0.18);
      if (warp > 0.08) {
        const len = (5 + st.z * 32) * warp;
        ctx.strokeStyle = `rgba(210, 225, 255, ${alpha * 0.8})`;
        ctx.lineWidth = Math.max(0.6, st.r * 0.9);
        ctx.beginPath();
        ctx.moveTo(st.x, st.y);
        ctx.lineTo(st.x + len * 0.18, st.y - len);
        ctx.stroke();
      } else {
        ctx.fillStyle = st.z > 0.78
          ? `rgba(196, 239, 255, ${alpha})`
          : `rgba(232, 228, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, TAU);
        ctx.fill();
      }
    }
  }

  /* ---------- ui helpers ---------- */
  function buildPips(container, count, className = '') {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const pip = document.createElement('i');
      if (className) pip.className = className;
      container.appendChild(pip);
    }
  }

  function setPips(container, level, max = 5) {
    if (!container) return;
    if (container.children.length !== max) buildPips(container, max);
    Array.from(container.children).forEach((node, i) => {
      node.classList.toggle('on', i < level);
    });
  }

  function buildHpPips(max) {
    el.hpPips.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const pip = document.createElement('span');
      pip.className = 'hp-pip';
      el.hpPips.appendChild(pip);
    }
  }

  function updateHpPips(player) {
    Array.from(el.hpPips.children).forEach((node, i) => {
      node.classList.toggle('on', i < player.hp);
      node.classList.toggle('empty', i >= player.hp);
    });
  }

  function updateShieldPips(player) {
    if (el.shieldPips.children.length !== player.maxShield) buildPips(el.shieldPips, player.maxShield);
    Array.from(el.shieldPips.children).forEach((node, i) => {
      node.classList.toggle('on', i < player.shield);
    });
  }

  function bestScoreKey() {
    return game.mode === 'endless'
      ? `best.endless.${game.difficulty.key}`
      : `best.${game.difficulty.key}`;
  }

  function bestLayerKey() {
    return `best.endless.${game.difficulty.key}.layer`;
  }

  function getBestScore() {
    return Number(safeGet(bestScoreKey(), 0)) || 0;
  }

  function getBestLayer() {
    return Number(safeGet(bestLayerKey(), 0)) || 0;
  }

  function refreshBest() {
    const best = getBestScore();
    let text = `最佳 ${fmtNum(best)}`;
    if (game.mode === 'endless') {
      const layer = getBestLayer();
      if (layer > 0) text += ` · 第 ${fmtNum(layer)} 层`;
    }
    el.best.textContent = text;
    return best;
  }

  function setMode(mode) {
    game.mode = mode === 'endless' ? 'endless' : 'campaign';
    document.querySelectorAll('.mode-option').forEach(btn => {
      const selected = btn.dataset.mode === game.mode;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
    el.modeNote.textContent = game.mode === 'endless'
      ? '无尽 · 冲击最深航迹'
      : '主线 · 约 3–5 分钟';
    el.launchLabel.textContent = game.mode === 'endless' ? '进入无尽深空' : '启动引擎';
    refreshBest();
  }

  function setDifficulty(key) {
    game.difficulty = DIFFICULTIES[key] || DIFFICULTIES.normal;
    document.querySelectorAll('.difficulty-option').forEach(btn => {
      const selected = btn.dataset.difficulty === game.difficulty.key;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
    refreshBest();
  }

  function currentShip() {
    return SHIPS[game.shipKey] || SHIPS.dushi;
  }

  function buildShipCards() {
    el.shipGrid.innerHTML = '';
    const statLabels = { fire: '火力', armor: '结构', shield: '护盾' };
    for (const key of SHIP_ORDER) {
      const ship = SHIPS[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ship-option';
      btn.dataset.ship = key;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', key === game.shipKey ? 'true' : 'false');
      btn.style.setProperty('--ship-color', ship.stroke);
      btn.style.setProperty('--ship-accent', ship.accent);
      const stats = Object.keys(statLabels).map(stat => {
        const value = ship.stats[stat] * 20;
        return `<span class="ship-stat"><i>${statLabels[stat]}</i><u><b style="width:${value}%"></b></u></span>`;
      }).join('');
      btn.innerHTML = `
        <span class="ship-preview">${SHIP_SVGS[key]}</span>
        <span class="ship-name">${ship.name}</span>
        <span class="ship-role">${ship.role} · ${ship.en}</span>
        <span class="ship-desc">${ship.desc}</span>
        <span class="ship-stats">${stats}</span>`;
      el.shipGrid.appendChild(btn);
    }
  }

  function setShip(key, persist = true) {
    if (!SHIPS[key]) key = 'dushi';
    game.shipKey = key;
    const ship = SHIPS[key];
    el.shipChipIcon.innerHTML = SHIP_SVGS[key];
    el.shipChipName.textContent = ship.name;
    el.shipChipRole.textContent = `${ship.role} · ${ship.en}`;
    el.shipChip.style.setProperty('--ship-color', ship.stroke);
    el.shipChip.style.setProperty('--ship-accent', ship.accent);
    document.querySelectorAll('.ship-option').forEach(btn => {
      const selected = btn.dataset.ship === key;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');
    });
    if (persist) safeSet('ship', key);
  }

  function openShipSelect() {
    el.screenShip.hidden = false;
    setShip(game.shipKey, false);
    const selected = el.shipGrid.querySelector('.ship-option.is-selected') || el.btnShipConfirm;
    setTimeout(() => selected.focus(), 30);
  }

  function closeShipSelect() {
    el.screenShip.hidden = true;
    el.shipChip.focus();
  }

  function setMuted(muted) {
    audio.setMuted(muted);
    document.body.classList.toggle('is-muted', muted);
    el.sound.setAttribute('aria-pressed', muted ? 'false' : 'true');
    el.sound.setAttribute('aria-label', muted ? '开启声音' : '关闭声音');
  }

  function showHint(text, duration = 7) {
    el.hint.textContent = text;
    el.hint.hidden = false;
    el.hint.classList.add('is-visible');
    el.hint.classList.remove('is-gone');
    game.hintT = duration;
  }

  function hideHint() {
    game.hintT = 0;
    el.hint.classList.remove('is-visible');
    el.hint.classList.add('is-gone');
  }

  function showStage(kicker, title, sub, duration = 2800) {
    el.stageKicker.textContent = kicker;
    el.stageTitle.textContent = title;
    el.stageSub.textContent = sub;
    el.stageBanner.hidden = false;
    el.stageBanner.classList.remove('is-visible');
    void el.stageBanner.offsetWidth;
    el.stageBanner.classList.add('is-visible');
    clearTimeout(stageTimer);
    stageTimer = setTimeout(() => {
      el.stageBanner.classList.remove('is-visible');
      setTimeout(() => { el.stageBanner.hidden = true; }, 560);
    }, duration);
  }

  function showBossBanner(title = '混沌核心 · 信号接入', sub = '三系协议失序 / 准备规避') {
    el.bossBanner.querySelector('strong').textContent = title;
    el.bossBanner.querySelector('.banner-sub').textContent = sub;
    el.bossBanner.hidden = false;
    el.bossBanner.classList.remove('is-out');
    void el.bossBanner.offsetWidth;
    clearTimeout(bossBannerTimer);
    bossBannerTimer = setTimeout(() => {
      el.bossBanner.classList.add('is-out');
      setTimeout(() => {
        el.bossBanner.hidden = true;
        el.bossBanner.classList.remove('is-out');
      }, 460);
    }, 2250);
  }

  function shuffledFacts(type) {
    const deck = KNOWLEDGE[type].slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return deck;
  }

  function showKnowledge(type, gainText) {
    const info = DISCIPLINES[type];
    const facts = KNOWLEDGE[type];
    const deck = game.knowledgeDeck[type] && game.knowledgeDeck[type].length
      ? game.knowledgeDeck[type] : facts;
    const index = game.knowledgeCursor[type] % deck.length;
    const fact = deck[index];
    game.knowledgeCursor[type] = (game.knowledgeCursor[type] + 1) % deck.length;
    game.knowledgeLog.push({ type, title: fact.title, text: fact.text });

    el.knowledge.dataset.dept = type;
    el.knowledgeDept.textContent = info.file;
    el.knowledgeNum.textContent = `${pad2(index + 1)} / ${pad2(deck.length)}`;
    el.knowledgeTitle.textContent = fact.title;
    el.knowledgeText.textContent = fact.text;
    el.knowledgeGain.textContent = gainText;
    el.knowledge.hidden = false;
    el.knowledge.classList.remove('is-visible');
    void el.knowledge.offsetWidth;
    el.knowledge.classList.add('is-visible');
    game.knowledgeT = 6.2;
    clearTimeout(knowledgeHideTimer);
    hideHint();
  }

  function hideKnowledge() {
    game.knowledgeT = 0;
    el.knowledge.classList.remove('is-visible');
    clearTimeout(knowledgeHideTimer);
    knowledgeHideTimer = setTimeout(() => {
      if (game.knowledgeT <= 0) el.knowledge.hidden = true;
    }, 300);
  }

  function flashDamage() {
    el.flash.classList.add('is-active');
    setTimeout(() => el.flash.classList.remove('is-active'), 110);
  }

  function updateHud(force = false) {
    if (!game.player) return;
    const p = game.player;
    el.score.textContent = fmtScore(game.score);
    el.time.textContent = fmtTime(game.time);
    el.diffPill.textContent = game.mode === 'endless'
      ? `无尽 L${game.cycle}`
      : game.difficulty.label;
    el.diffPill.classList.toggle('is-endless', game.mode === 'endless');
    el.hpText.textContent = `${Math.max(0, p.hp)} / ${p.maxHp}`;
    updateHpPips(p);
    updateShieldPips(p);

    for (const key of ['aero', 'code', 'ie']) {
      const level = key === 'aero' ? p.fireLvl : key === 'code' ? p.codeLvl : p.ieLvl;
      setPips(el.pips[key], level);
      el.lvl[key].textContent = String(level);
    }

    const charge = Math.floor(p.bomb);
    el.bomb.style.setProperty('--charge', String(charge));
    el.bomb.classList.toggle('is-ready', charge >= 100);
    el.bomb.disabled = charge < 100;
    el.bomb.setAttribute('aria-label', charge >= 100
      ? '释放笃实脉冲，充能已满'
      : `释放笃实脉冲，当前充能 ${charge}%`);
    el.bombCharge.textContent = `${charge}%`;

    if (game.boss) {
      const b = game.boss;
      const ratio = clamp(b.hp / b.maxHp, 0, 1);
      el.bossFill.style.transform = `scaleX(${ratio})`;
      el.bossHp.textContent = `${Math.ceil(ratio * 100)}%`;
      el.bossPhase.textContent = b.isMidboss ? '道中 · 笃实人能飞' : (PHASE_NAMES[b.phase] || '混沌核心');
      el.bossTrack.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
      el.bossUi.classList.toggle('is-transition', b.transition > 0);
    }
  }

  function updateRotateTip() {
    const landscape = window.innerWidth > window.innerHeight && window.innerHeight < 560;
    el.rotateTip.hidden = !(landscape && (game.scene === 'title' || game.phase === 'combat'));
  }

  /* ---------- run lifecycle ---------- */
  function resetRun() {
    game.time = 0;
    game.score = 0;
    game.kills = 0;
    game.pickups = 0;
    game.graze = 0;
    game.bombCount = 0;
    game.cycle = 1;
    game.nextBossAt = game.mode === 'endless' ? ENDLESS_FIRST_BOSS_TIME : CAMPAIGN_BOSS_TIME;
    game.midbossDone = false;
    game.nextEliteAt = 24;
    game.nextHighThreatAt = 24;
    game.lastHighThreatAt = 14;
    game.waveIndex = 0;
    game.waveBudget = 3;
    game.spawnCounts = {};
    game.carrierSeen = false;
    game.enemyScale = 1;
    game.enemyBulletScale = 1;
    game.phase = 'combat';
    game.paused = false;
    game.spawnT = 3.0;
    game.eliteT = 0;
    game.pickupT = 5;
    game.pickupCycle = 0;
    game.stage2 = false;
    game.stage3 = false;
    game.bossSpawned = false;
    game.boss = null;
    game.enemies = [];
    game.pBullets = [];
    game.eBullets = [];
    game.gearFormation = null;
    game.drops = [];
    game.particles = [];
    game.rings = [];
    game.floats = [];
    game.portal = null;
    game.shake = 0;
    game.flash = 0;
    game.slowT = 0;
    game.warp = 0;
    game.endT = 0;
    game.endWin = false;
    game.knowledgeT = 0;
    game.knowledgeCursor = { aero: 0, code: 0, ie: 0 };
    game.knowledgeDeck = {
      aero: shuffledFacts('aero'),
      code: shuffledFacts('code'),
      ie: shuffledFacts('ie')
    };
    game.knowledgeLog = [];
    game.pointer.active = false;
    game.keys.clear();

    const diff = game.difficulty;
    const ship = currentShip();
    // 三档难度共用标准结构值，战机自身的结构修正仍然生效。
    const maxHp = clamp(BASE_STRUCTURE + ship.hpMod, 1, 6);
    game.player = {
      x: W * 0.5,
      y: H * 0.79,
      tx: W * 0.5,
      ty: H * 0.79,
      vx: 0,
      vy: 0,
      tilt: 0,
      // 自机只判定中央小点，机体轮廓不参与碰撞；pickupR 只用于拾取与传送门。
      r: 2.0 * S * ship.hitbox,
      pickupR: 6.2 * S,
      grazeR: 27 * S,
      maxHp,
      hp: maxHp,
      maxShield: ship.shieldMax,
      shield: ship.startShield,
      inv: 1.4,
      fireLvl: 1,
      codeLvl: 0,
      ieLvl: 0,
      bomb: 0,
      fireT: 0.18,
      dead: false,
      engineT: 0,
      shipKey: ship.key,
      shipDef: ship,
      speedMul: ship.speed,
      fireRateMul: ship.fireRate,
      damage: ship.damage
    };

    buildHpPips(game.player.maxHp);
    updateShieldPips(game.player);
    for (const key of ['aero', 'code', 'ie']) setPips(el.pips[key], 0);
    el.lvl.aero.textContent = '1';
    el.lvl.code.textContent = '0';
    el.lvl.ie.textContent = '0';
    el.lvl.aero.textContent = String(game.player.fireLvl);

    el.bossUi.hidden = true;
    el.hud.classList.remove('boss-active');
    el.stageBanner.hidden = true;
    el.stageBanner.classList.remove('is-visible');
    el.bossBanner.hidden = true;
    el.knowledge.hidden = true;
    el.knowledge.classList.remove('is-visible');
    el.bomb.disabled = true;
    updateHud(true);
    if (game.mode === 'endless') {
      el.diffPill.textContent = '无尽 L1';
      el.diffPill.classList.add('is-endless');
      showStage('ENDLESS DESCENT', '深空第 1 层', '生存越久，熵增强度越高 · 70 秒后核心接入', 3400);
      showHint('无尽模式 · 每 70 秒迎战一次混沌核心 · 层数越高越强', 8);
    } else {
      el.diffPill.textContent = diff.label;
      el.diffPill.classList.remove('is-endless');
      showStage('航段 01', '外环星域', '保持航向 · 收集三系文明碎片', 3000);
      showHint('按住任意位置拖动 · 自动开火 · 收集三系徽章', 7.5);
    }
  }

  function startMenuBgm() {
    if (game.scene !== 'title' && game.scene !== 'result') return;
    audio.init();
    audio.startBgm('menu');
  }

  function startGame() {
    audio.init();
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    audio.suspendForPause(false);
    audio.startBgm('normal');
    game.scene = 'playing';
    game.paused = false;
    el.title.hidden = true;
    el.pause.hidden = true;
    el.result.hidden = true;
    el.hud.hidden = false;
    el.hud.style.animation = 'none';
    void el.hud.offsetWidth;
    el.hud.style.animation = '';
    el.diffPill.textContent = game.difficulty.label;
    el.diffPill.classList.remove('is-endless');
    resetRun();
    updateRotateTip();
  }

  function goHome() {
    if (game.phase === 'ending' || game.scene === 'result') {
      // result screen -> title
    }
    game.scene = 'title';
    game.phase = 'combat';
    game.paused = false;
    game.player = null;
    game.boss = null;
    game.enemies = [];
    game.pBullets = [];
    game.eBullets = [];
    game.gearFormation = null;
    game.drops = [];
    game.portal = null;
    game.particles = [];
    game.rings = [];
    game.floats = [];
    game.pointer.active = false;
    game.keys.clear();
    el.hud.hidden = true;
    el.pause.hidden = true;
    el.result.hidden = true;
    el.title.hidden = false;
    el.title.scrollTop = 0;
    el.stageBanner.hidden = true;
    el.bossBanner.hidden = true;
    el.knowledge.hidden = true;
    el.hint.hidden = true;
    el.bossUi.hidden = true;
    el.hud.classList.remove('boss-active');
    audio.suspendForPause(false);
    audio.setBgmMode('menu');
    refreshBest();
    updateRotateTip();
  }

  function pauseGame() {
    if (game.scene !== 'playing' || game.paused || game.phase === 'ending') return;
    game.paused = true;
    game.pointer.active = false;
    game.keys.clear();
    el.pause.hidden = false;
    audio.suspendForPause(true);
    setTimeout(() => $('btn-resume').focus(), 30);
  }

  function resumeGame() {
    if (!game.paused) return;
    game.paused = false;
    el.pause.hidden = true;
    audio.suspendForPause(false);
    el.pauseBtn.focus();
  }

  function endRun(win) {
    if (game.scene !== 'playing' || game.phase === 'ending') return;
    game.phase = 'ending';
    game.endWin = win;
    game.endT = win ? 1.2 : 1.55;
    game.paused = false;
    game.pointer.active = false;
    game.keys.clear();
    hideHint();
    audio.setBgmMode('normal');
    const p = game.player;
    if (win) {
      game.flash = 0.55;
      game.warp = 1;
      addRing(game.portal ? game.portal.x : p.x, game.portal ? game.portal.y : p.y, 26 * S, 260 * S, '#67e8f9', 0.9, 3);
      spawnBurst(p.x, p.y, '#a5f3fc', 52, 260, 2.2);
      audio.victory();
    } else {
      p.dead = true;
      game.flash = 0.35;
      game.shake = 26;
      spawnBurst(p.x, p.y, '#fb7185', 48, 220, 2.6);
      spawnBurst(p.x, p.y, '#f5c96b', 20, 150, 1.8);
      addRing(p.x, p.y, 8 * S, 160 * S, '#fb7185', 0.8, 3);
      audio.fail();
    }
    const best = Math.max(getBestScore(), Math.floor(game.score));
    safeSet(bestScoreKey(), best);
    if (game.mode === 'endless') {
      safeSet(bestLayerKey(), Math.max(getBestLayer(), game.cycle));
    }
    updateHud(true);
  }

  function renderResultKnowledge() {
    const seen = new Set();
    const entries = [];
    for (const entry of game.knowledgeLog) {
      const key = `${entry.type}:${entry.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
    const deptOrder = { aero: 0, code: 1, ie: 2 };
    entries.sort((a, b) => deptOrder[a.type] - deptOrder[b.type]);
    el.resultKnowledge.hidden = false;
    el.resultKnowledgeCount.textContent = `${entries.length} 张`;
    el.resultKnowledgeList.innerHTML = '';
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'result-knowledge-empty';
      empty.textContent = '本局未拾取到知识碎片。下一次留意三系徽章，它们会留下对应的知识卡片。';
      el.resultKnowledgeList.appendChild(empty);
      return;
    }
    for (const entry of entries) {
      const info = DISCIPLINES[entry.type];
      const card = document.createElement('article');
      card.className = 'result-knowledge-card';
      card.dataset.dept = entry.type;
      const dept = document.createElement('span');
      dept.className = 'result-knowledge-dept';
      dept.textContent = `${info.label} · ${info.file}`;
      const title = document.createElement('h4');
      title.textContent = entry.title;
      const text = document.createElement('p');
      text.textContent = entry.text;
      card.append(dept, title, text);
      el.resultKnowledgeList.appendChild(card);
    }
  }

  function showResult(win) {
    game.scene = 'result';
    game.paused = false;
    el.hud.hidden = true;
    el.pause.hidden = true;
    el.title.hidden = true;
    el.result.hidden = false;
    audio.setBgmMode('menu');
    el.result.classList.remove('is-failure');
    el.resultStatus.classList.remove('is-win', 'is-endless');
    if (!win) el.result.classList.add('is-failure');

    const best = Math.max(getBestScore(), Math.floor(game.score));
    const bestLayer = game.mode === 'endless' ? getBestLayer() : 0;
    el.resultScore.textContent = fmtNum(game.score);
    el.resultBest.textContent = game.mode === 'endless' && bestLayer > 0
      ? `最佳 ${fmtNum(best)} · 第 ${fmtNum(bestLayer)} 层`
      : `最佳 ${fmtNum(best)}`;
    el.statTime.textContent = fmtTime(game.time);
    el.statKills.textContent = fmtNum(game.kills);
    el.statPickups.textContent = fmtNum(game.pickups);
    el.statGraze.textContent = fmtNum(game.graze);
    el.statLayerCell.hidden = game.mode !== 'endless';
    el.statLayer.textContent = fmtNum(game.cycle);
    el.resultShip.textContent = `战机 · ${currentShip().name}`;
    el.resultAero.textContent = game.player ? String(game.player.fireLvl) : '0';
    el.resultCode.textContent = game.player ? String(game.player.codeLvl) : '0';
    el.resultIe.textContent = game.player ? String(game.player.ieLvl) : '0';

    if (game.mode === 'endless') {
      el.resultKicker.textContent = `DUSHI 64 · LAYER ${pad2(game.cycle)}`;
      el.resultStatus.textContent = 'RUN ENDED';
      el.resultStatus.classList.add('is-endless');
      el.resultTitle.textContent = `止步第 ${game.cycle} 层`;
      el.resultSubtitle.textContent = game.cycle <= 1
        ? '深空没有终点。调整航向、优先拾取护盾，下一轮把航迹推得更远。'
        : `笃实号在深空第 ${game.cycle} 层失联。下一轮，试着把航迹推得更远。`;
      el.resultCert.hidden = true;
      $('btn-again').textContent = '再次下潜';
    } else if (win) {
      el.resultKicker.textContent = 'DUSHI 64 · MISSION SUCCESS';
      el.resultStatus.textContent = 'MISSION COMPLETE';
      el.resultStatus.classList.add('is-win');
      el.resultTitle.textContent = '抵达终点';
      el.resultSubtitle.textContent = '你穿过了混沌核心的最后一层弹幕。跃迁门在星光中重新点亮，笃实号回家了。';
      el.resultCert.hidden = false;
      el.certLine.textContent = `深空纪元 2147 · 跃迁终点 · ${game.difficulty.label}难度`;
      $('btn-again').textContent = '再次出航';
    } else {
      el.resultKicker.textContent = 'DUSHI 64 · SIGNAL LOST';
      el.resultStatus.textContent = 'SIGNAL LOST';
      el.resultStatus.classList.remove('is-win');
      el.resultTitle.textContent = '航行终止';
      el.resultSubtitle.textContent = '混沌核心仍在呼吸。调校航向，收集三系碎片，下一次会走得更远。';
      el.resultCert.hidden = true;
      $('btn-again').textContent = '重整旗鼓';
    }
    renderResultKnowledge();
    refreshBest();
    setTimeout(() => {
      const btn = $('btn-again');
      if (btn) btn.focus({ preventScroll: true });
    }, 50);
  }

  /* ---------- player ---------- */
  function shipBulletScale(p) {
    return p.shipKey === 'changcheng' ? 1.3 : p.shipKey === 'xinghuo' ? 0.88 : 1;
  }

  function wingmanCount(fireLvl) {
    return clamp((fireLvl | 0) - 1, 0, 4);
  }

  function wingmanSlots(count) {
    const angles = count <= 0 ? []
      : count === 1 ? [0]
        : count === 2 ? [-Math.PI / 3, Math.PI / 3]
          : count === 3 ? [0, -Math.PI / 3, Math.PI / 3]
            : [-Math.PI / 3, -Math.PI / 9, Math.PI / 9, Math.PI / 3];
    const r = 44 * S;
    return angles.map(a => ({
      x: Math.sin(a) * r,
      y: Math.cos(a) * r,
      angle: a
    }));
  }

  function fireWingmen(p, def) {
    const count = wingmanCount(p.fireLvl);
    if (count <= 0) return;
    const slots = wingmanSlots(count);
    const speed = 800 * S;
    const size = 3.1 * S * shipBulletScale(p);
    const style = p.shipDef?.wingmanStyle || 'focus';
    for (const slot of slots) {
      const bx = p.x + slot.x;
      const by = p.y + slot.y;
      let angle = 0;
      if (style === 'homing') {
        const target = nearestTarget(bx, by, 520 * S);
        if (target) angle = Math.atan2(target.y - by, target.x - bx);
      } else if (style === 'wide') {
        angle = (slot.x / (44 * S)) * 0.2;
      } else {
        angle = -(slot.x / (44 * S)) * 0.06;
      }
      addPlayerBullet(
        bx, by,
        Math.sin(angle) * speed,
        -Math.cos(angle) * speed,
        p.damage, size, def.secondary,
        style === 'homing' ? { homing: true, speed } : {}
      );
    }
  }

  function fireWeapon() {
    const p = game.player;
    if (!p || p.dead) return;
    const def = p.shipDef || SHIPS.dushi;
    const speed = 800 * S;
    const shots = p.fireLvl >= 2
      ? [{ ox: -5.5, a: 0 }, { ox: 5.5, a: 0 }]
      : [{ ox: 0, a: 0 }];
    const sizeScale = shipBulletScale(p);
    shots.forEach((shot, index) => {
      addPlayerBullet(
        p.x + shot.ox * S,
        p.y - 18 * S,
        Math.sin(shot.a) * speed,
        -Math.cos(shot.a) * speed,
        p.damage,
        3.1 * S * sizeScale,
        index === 0 ? def.bullet : def.secondary
      );
    });
    fireWingmen(p, def);
    spawnBurst(p.x, p.y - 19 * S, def.accent, 2, 40, 1.2);
    audio.shoot();
  }

  function nearestTarget(x, y, maxDist = 500 * S) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (game.boss && !game.boss.dead && !game.boss.entry) {
      const d = dist2(x, y, game.boss.x, game.boss.y);
      if (d < bestD) { bestD = d; best = game.boss; }
    }
    return best;
  }

  function updatePlayer(dt) {
    const p = game.player;
    if (!p || p.dead) return;
    if (game.debugAutoTrack && game.boss && !game.boss.dead) {
      p.tx = game.boss.x;
      p.ty = H * 0.78;
    }
    p.inv = Math.max(0, p.inv - dt);
    p.fireT -= dt;

    let kx = 0, ky = 0;
    if (game.keys.has('ArrowLeft') || game.keys.has('KeyA')) kx -= 1;
    if (game.keys.has('ArrowRight') || game.keys.has('KeyD')) kx += 1;
    if (game.keys.has('ArrowUp') || game.keys.has('KeyW')) ky -= 1;
    if (game.keys.has('ArrowDown') || game.keys.has('KeyS')) ky += 1;
    if (kx || ky) {
      const len = Math.hypot(kx, ky) || 1;
      const speed = 530 * S * (1 + p.ieLvl * 0.045) * (p.speedMul || 1);
      p.tx += (kx / len) * speed * dt;
      p.ty += (ky / len) * speed * dt;
    }

    const minX = 16 * S;
    const maxX = W - 16 * S;
    const minY = H * (game.phase === 'final' ? 0.08 : 0.16);
    const maxY = H - 74 * S;
    p.tx = clamp(p.tx, minX, maxX);
    p.ty = clamp(p.ty, minY, maxY);

    const ease = 1 - Math.exp(-24 * dt);
    const dx = p.tx - p.x;
    p.x += dx * ease;
    p.y += (p.ty - p.y) * ease;
    p.tilt = lerp(p.tilt, clamp(dx / (70 * S), -1, 1) * 0.24, 1 - Math.exp(-10 * dt));

    p.engineT -= dt;
    if (p.engineT <= 0) {
      p.engineT = 0.035;
      game.particles.push({
        x: p.x + rand(-3, 3) * S,
        y: p.y + 15 * S,
        vx: rand(-14, 14) * S,
        vy: rand(80, 150) * S,
        life: rand(0.18, 0.38),
        max: 0.38,
        size: rand(1, 2.2) * S,
        color: Math.random() > 0.45 ? (p.shipDef?.accent || '#67e8f9') : (p.shipDef?.secondary || '#a78bfa'),
        drag: 0.92,
        glow: true
      });
    }

    if (!p.dead && game.phase !== 'final' && game.phase !== 'ending') {
      if (p.fireT <= 0) {
        fireWeapon();
        p.fireT = 0.165 / (1 + p.ieLvl * 0.018) / (p.fireRateMul || 1);
      }
    }
  }

  function hitPlayer(sourceX, sourceY) {
    const p = game.player;
    if (!p || p.dead || p.inv > 0 || game.debugGod) return false;
    if (p.shield > 0) {
      p.shield--;
      p.inv = 1.2;
      game.shake = Math.max(game.shake, 8);
      addRing(p.x, p.y, 16 * S, 72 * S, '#67e8f9', 0.55, 2);
      spawnBurst(p.x, p.y, '#67e8f9', 18, 150, 1.6);
      addFloat(p.x, p.y - 28 * S, '护盾 -1', '#67e8f9', 11);
      audio.tone(420, 0.22, 'sine', 0.06, 160);
      updateHud(true);
      return true;
    }
    p.hp--;
    p.inv = 2.0;
    game.shake = Math.max(game.shake, 16);
    game.flash = Math.max(game.flash, 0.32);
    flashDamage();
    spawnBurst(p.x, p.y, '#fb7185', 24, 190, 2);
    addRing(p.x, p.y, 10 * S, 110 * S, '#fb7185', 0.55, 2);
    addFloat(p.x, p.y - 30 * S, '结构受损', '#fb7185', 11);
    audio.damage();
    updateHud(true);
    if (p.hp <= 0) endRun(false);
    return true;
  }

  /* ---------- player bullets ---------- */
  function addPlayerBullet(x, y, vx, vy, dmg, r, color, extra = {}) {
    if (game.pBullets.length > 140) game.pBullets.shift();
    const bullet = {
      x, y, vx, vy, dmg, r,
      color: color || '#a5f3fc',
      life: 1.4
    };
    Object.assign(bullet, extra);
    game.pBullets.push(bullet);
    return bullet;
  }

  function updatePlayerBullets(dt) {
    const bs = game.pBullets;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      if (b.homing) {
        if (!b.target || b.target.dead) b.target = nearestTarget(b.x, b.y, 520 * S);
        if (b.target) {
          const a = Math.atan2(b.target.y - b.y, b.target.x - b.x);
          b.vx = Math.cos(a) * (b.speed || 800 * S);
          b.vy = Math.sin(a) * (b.speed || 800 * S);
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30) {
        bs.splice(i, 1);
        continue;
      }
      let hit = false;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (e.r + b.r) * (e.r + b.r)) {
          damageEnemy(e, b.dmg, b.x, b.y);
          hit = true;
          break;
        }
      }
      if (!hit && game.boss && !game.boss.dead && !game.boss.entry && !game.boss.invuln) {
        const boss = game.boss;
        if (dist2(b.x, b.y, boss.x, boss.y) < (boss.r + b.r) * (boss.r + b.r)) {
          damageBoss(b.dmg, b.x, b.y);
          hit = true;
        }
      }
      if (hit) {
        spawnBurst(b.x, b.y, b.color, 2, 30, 1.2);
        bs.splice(i, 1);
      }
    }
  }

  const MAX_ENEMY_BULLETS = 900;

  /* ---------- enemy bullets ---------- */
  function addEnemyBullet(x, y, vx, vy, r, color, type = 'orb', extra = {}) {
    if (game.eBullets.length >= MAX_ENEMY_BULLETS) {
      // 成批移除最旧的子弹，避免一次齐射内反复 shift() 造成帧尖峰。
      game.eBullets.splice(0, 64);
    }
    const speedScale = game.enemyBulletScale || 1;
    const bullet = {
      x, y,
      vx: vx * speedScale,
      vy: vy * speedScale,
      r,
      color: color || '#fb7185',
      type,
      life: extra.life || 8,
      angle: Math.atan2(vy, vx),
      spin: extra.spin || 0,
      grazed: false
    };
    Object.assign(bullet, extra);
    bullet.grazed = false;
    game.eBullets.push(bullet);
    return bullet;
  }

  function radialShot(x, y, count, speed, offset, color, type = 'orb', radius = 4 * S, layers = 1, speedStep = 0, angleStep = 0) {
    for (let layer = 0; layer < layers; layer++) {
      const layerSpeed = speed + layer * speedStep;
      const layerAngle = offset + layer * angleStep;
      for (let i = 0; i < count; i++) {
        const a = layerAngle + (TAU * i) / count;
        addEnemyBullet(x, y, Math.cos(a) * layerSpeed, Math.sin(a) * layerSpeed, radius, color, type);
      }
    }
  }

  // 东方风"等差弹速"：同一条瞄准线上同时射出多颗速度呈等差数列的子弹，
  // 后发先至、层层收束，形成可读可钻的一条弹道。难度只改变发数。
  function ladderShot(x, y, count, midSpeed, step, color, type = 'rice', radius = 3.2 * S) {
    if (count <= 0) return;
    const p = game.player;
    if (!p || p.dead) return;
    const base = Math.atan2(p.y - y, p.x - x);
    const vx = Math.cos(base);
    const vy = Math.sin(base);
    for (let i = 0; i < count; i++) {
      const speed = midSpeed + (i - (count - 1) / 2) * step;
      addEnemyBullet(x, y, vx * speed, vy * speed, radius, color, type);
    }
  }

  // 编织者：瞄准发射快速自转星弹，沿途留下小星弹拖尾。
  // 困难不再散射三颗主星，而是把单颗主星的拖尾密度翻倍。
  function weaverVolley(x, y, tier) {
    const p = game.player;
    if (!p || p.dead) return;
    const base = Math.atan2(p.y - y, p.x - x);
    const speed = 195 * S;
    addEnemyBullet(x, y, Math.cos(base) * speed, Math.sin(base) * speed,
      5.4 * S, '#f472b6', 'star', {
        life: Infinity,
        spin: 2.4,
        mainStar: true,
        dirAngle: base,
        trailT: 0.03,
        trailInterval: tier === 2 ? 0.13 : 0.26,
        trailDelay: 0.65,
        trailMode: tier === 0 ? 'vanish' : 'move',
        trailIndex: 0,
        trailAccel: 110 * S,
        trailColor: '#c4b5fd'
      });
  }

  // 软件协议：多条旋臂同时展开，臂数随难度增加。
  function spiralVolley(x, y, arms, offset, speed, colorA, colorB = colorA, type = 'orb', radius = 3.8 * S, layers = 1, speedStep = 0, angleStep = 0) {
    for (let layer = 0; layer < layers; layer++) {
      const layerSpeed = speed + layer * speedStep;
      const layerAngle = offset + layer * angleStep;
      for (let i = 0; i < arms; i++) {
        const a = layerAngle + (TAU * i) / arms;
        addEnemyBullet(x, y, Math.cos(a) * layerSpeed, Math.sin(a) * layerSpeed,
          radius, i % 2 ? colorB : colorA, type);
      }
    }
  }

  // 炮台专用：向下方 / 左下 / 右下三个相隔 120° 的方向集中，
  // 每个方向 2 / 3 / 4 根齿，每根齿包含完整的 8 / 10 / 12 层。
  function turretVolley(x, y, tier, dir, baseAngle = Math.PI / 2) {
    const teeth = [2, 3, 4][tier];
    const layers = ENEMY_LAYER_COUNT[tier];
    const toothStep = (20 * Math.PI) / 180;
    const layerStep = (5.5 * Math.PI) / 180 * dir;
    const midT = (teeth - 1) / 2;
    const midL = (layers - 1) / 2;
    const color = '#fb923c';
    for (let g = 0; g < 3; g++) {
      const group = baseAngle + (TAU * g) / 3;
      for (let t = 0; t < teeth; t++) {
        const tooth = group + (t - midT) * toothStep;
        for (let l = 0; l < layers; l++) {
          const a = tooth + (l - midL) * layerStep;
          const speed = (96 + l * 13) * S * 0.5;
          addEnemyBullet(x, y, Math.cos(a) * speed, Math.sin(a) * speed,
            4.2 * S, color, 'orb', { life: Infinity });
        }
      }
    }
    addRing(x, y, 10 * S, 75 * S, color, 0.45, 1.5);
  }

  function updateEnemyBullets(dt) {
    const p = game.player;
    const bs = game.eBullets;
    const pendingTrails = [];
    const pendingBigStars = [];
    if (game.gearFormation) updateGearFormation(dt);
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      if (!b.gearGroup) {
        if (b.accelerating) {
          b.vx += b.ax * dt;
          b.vy += b.ay * dt;
          b.angle = Math.atan2(b.vy, b.vx);
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      b.life -= dt;
      if (b.type === 'square' || (b.type === 'star' && b.spin)) b.angle += b.spin * dt;

      // 被吸向 Boss 的星弹：碰到 Boss 后消失，并累积大星弹充能。
      if (b.bossAbsorb) {
        const boss = game.boss;
        if (!boss || boss.dead) {
          b.life = 0;
        } else {
          const rr = boss.r * 0.75 + b.r;
          if (dist2(b.x, b.y, boss.x, boss.y) < rr * rr) {
            boss.absorbCharge += b.absorbValue || 0;
            boss.absorbPulse = 1;
            spawnBurst(b.x, b.y, '#f5c96b', 2, 50, 1.3);
            b.life = 0;
            while (boss.absorbCharge >= boss.absorbTarget) {
              boss.absorbCharge -= boss.absorbTarget;
              pendingBigStars.push(true);
            }
          }
        }
      }

      if (b.life <= 0 || (!b.bossAbsorb && !b.gearGroup && (b.x < -55 || b.x > W + 55 || b.y < -80 || b.y > H + 70))) {
        bs.splice(i, 1);
        continue;
      }
      // 编织者主星弹沿路径留下小星弹拖尾。
      if (b.mainStar) {
        b.trailT -= dt;
        let guard = 0;
        while (b.trailT <= 0 && guard++ < 4) {
          pendingTrails.push({
            x: b.x,
            y: b.y,
            vx: 0,
            vy: 0,
            r: 3.0 * S,
            color: b.trailColor || b.color,
            type: 'star',
            life: b.trailDelay + 3.0,
            angle: b.dirAngle,
            spin: 0,
            grazed: false,
            dirAngle: b.dirAngle,
            trailDelay: b.trailDelay,
            trailMode: b.trailMode,
            trailSide: (b.trailIndex++ % 2) ? 1 : -1,
            lateralAccel: b.trailAccel * (game.enemyBulletScale || 1),
            released: false
          });
          b.trailT += b.trailInterval;
        }
      }
      // 大星弹留下短暂停留的小星星轨迹。
      if (b.bigStar) {
        b.trailT -= dt;
        let guard = 0;
        while (b.trailT <= 0 && guard++ < 3) {
          pendingTrails.push({
            x: b.x,
            y: b.y,
            vx: 0,
            vy: 0,
            r: 2.2 * S,
            color: '#f5c96b',
            type: 'star',
            life: b.trailLife,
            angle: rand(0, TAU),
            spin: 0,
            grazed: false
          });
          b.trailT += b.trailInterval;
        }
      }
      // 拖尾弹先停留，随后消失或向主弹轨迹两侧分开。
      if (!b.mainStar && b.trailDelay > 0 && !b.released) {
        b.trailDelay -= dt;
        if (b.trailDelay <= 0) {
          b.released = true;
          if (b.trailMode === 'vanish') {
            spawnBurst(b.x, b.y, b.color, 1, 26, 1);
            b.life = 0;
          } else {
            const perp = b.dirAngle + Math.PI / 2;
            b.ax = Math.cos(perp) * b.lateralAccel * b.trailSide;
            b.ay = Math.sin(perp) * b.lateralAccel * b.trailSide;
            b.vx = 0;
            b.vy = 0;
            b.accelerating = true;
            b.angle = perp + (b.trailSide > 0 ? 0 : Math.PI);
            b.life = Infinity;
          }
        }
      }
      if (!p || p.dead) continue;
      const rr = b.r + p.r;
      const d2 = dist2(b.x, b.y, p.x, p.y);
      if (d2 < rr * rr) {
        if (p.inv <= 0) {
          if (hitPlayer(b.x, b.y)) {
            bs.splice(i, 1);
            continue;
          }
        }
      } else if (!b.grazed && p.inv <= 0) {
        const gr = b.r + p.grazeR;
        if (d2 < gr * gr) {
          b.grazed = true;
          game.graze++;
          game.score += 8 * game.difficulty.scoreMul;
          p.bomb = Math.min(100, p.bomb + 0.7 * PULSE_GAIN_MULT);
          spawnBurst(b.x, b.y, '#c4b5fd', 1, 28, 1);
          if (game.graze % 5 === 0) {
            audio.tone(1250, 0.04, 'sine', 0.008, 1500);
          }
        }
      }
    }
    for (let k = 0; k < pendingBigStars.length; k++) fireBossBigStar(game.boss);
    if (pendingTrails.length) {
      game.eBullets.push(...pendingTrails);
      if (game.eBullets.length > MAX_ENEMY_BULLETS) {
        game.eBullets.splice(0, game.eBullets.length - MAX_ENEMY_BULLETS);
      }
    }
  }

  /* ---------- enemies ---------- */
  function spawnEnemy(kind, x, y, opts = {}) {
    if (game.enemies.length > 16 && !opts.force) return null;
    const hpScale = game.enemyScale;
    const base = {
      kind,
      x,
      y,
      x0: x,
      y0: y,
      t: rand(0, TAU),
      age: 0,
      leaveAt: kind === 'wingman' ? 0 : (ENEMY_LEAVE_TIME[kind] || 20),
      phase: rand(0, TAU),
      dead: false,
      hitT: 0,
      fireT: rand(0.7, 1.7),
      volley: 0,
      drop: false
    };
    if (kind === 'drone') {
      Object.assign(base, {
        r: 11 * S, hp: 2 * hpScale, maxHp: 2 * hpScale,
        score: 22, vy: 83 * S, vx: rand(-24, 24) * S, fireT: 0.35
      });
    } else if (kind === 'weaver') {
      Object.assign(base, {
        r: 14.5 * S, hp: 6 * hpScale, maxHp: 6 * hpScale,
        score: 46, vy: 64 * S, targetY: H * rand(0.18, 0.30), state: 'enter', fireT: 0.35,
        sweepDir: x < W * 0.5 ? 1 : -1, sweepSpeed: rand(46, 60) * S
      });
    } else if (kind === 'turret') {
      Object.assign(base, {
        r: 18 * S, hp: 24 * hpScale, maxHp: 24 * hpScale,
        score: 82, vy: 160 * S, targetY: H * rand(0.17, 0.28), state: 'enter', spin: 0, fireT: 0.35
      });
    } else if (kind === 'lancer') {
      Object.assign(base, {
        r: 10 * S, hp: 2 * hpScale, maxHp: 2 * hpScale,
        score: 34, vy: 150 * S, vx: rand(-72, 72) * S, fired: false, fireT: 0.2
      });
    } else if (kind === 'sentinel') {
      Object.assign(base, {
        r: 16 * S, hp: 28.8 * hpScale, maxHp: 28.8 * hpScale,
        score: 72, vy: 160 * S, targetY: H * rand(0.17, 0.27), state: 'enter', fireT: 0.35,
        spin: rand(0, TAU), blinkT: rand(3.6, 5.2), targetX: x
      });
    } else if (kind === 'carrier') {
      Object.assign(base, {
        r: 26 * S, hp: 60 * hpScale, maxHp: 60 * hpScale,
        score: 145, vy: 160 * S, targetY: H * rand(0.18, 0.24), state: 'enter',
        drop: true,
        driftDir: x < W * 0.5 ? 1 : -1, driftSpeed: rand(10, 14) * S,
        escortT: 0.05,
        escortTotal: [4, 6, 8][game.difficulty.tier],
        escortPhase: rand(0, TAU),
        escortDir: Math.random() < 0.5 ? -1 : 1,
        escortRings: [],
        escortRingId: 0
      });
    } else if (kind === 'wingman') {
      Object.assign(base, {
        r: 7 * S, hp: 1 * hpScale, maxHp: 1 * hpScale,
        score: 8, vy: 0, vx: 0,
        leader: opts.leader || null,
        ring: opts.ring || null,
        slot: opts.slot || 0,
        fireT: rand(0.2, 0.5)
      });
    } else {
      Object.assign(base, {
        r: 29 * S, hp: 85 * hpScale, maxHp: 85 * hpScale,
        score: 280, vy: 42 * S, targetY: H * rand(0.19, 0.26), state: 'enter',
        drop: true, elite: true, fireT: 1.4
      });
    }
    if (opts.drop) base.drop = true;
    if (opts.x0 !== undefined) base.x0 = opts.x0;
    if (opts.phase !== undefined) base.phase = opts.phase;
    if (opts.leader) base.leader = opts.leader;
    if (opts.ring) base.ring = opts.ring;
    if (opts.slot !== undefined) base.slot = opts.slot;
    game.spawnCounts[kind] = (game.spawnCounts[kind] || 0) + 1;
    if (kind === 'carrier') game.carrierSeen = true;
    game.enemies.push(base);
    return base;
  }

  function highThreatCount() {
    return game.enemies.reduce((sum, e) =>
      sum + ((SPAWN_TABLE[e.kind] && SPAWN_TABLE[e.kind].high) || e.kind === 'elite' ? 1 : 0), 0);
  }

  function spawnSpawnGroup(kind, n) {
    for (let i = 0; i < n; i++) {
      let x;
      if (kind === 'drone') {
        x = W * (0.16 + (0.68 * (i + 0.5)) / n) + rand(-10, 10) * S;
      } else if (kind === 'weaver') {
        x = W * (0.22 + (0.56 * (i + 0.5)) / n) + rand(-10, 10) * S;
      } else if (kind === 'lancer') {
        x = W * rand(0.18, 0.82);
      } else if (kind === 'turret') {
        x = W * rand(0.28, 0.72);
      } else if (kind === 'sentinel') {
        x = W * rand(0.24, 0.76);
      } else if (kind === 'carrier') {
        x = W * rand(0.3, 0.7);
      } else {
        x = W * 0.5;
      }
      const yBase = kind === 'carrier' ? -70 : kind === 'weaver' ? -40 : -35;
      const spawned = spawnEnemy(kind, x, yBase * S - i * 38 * S, { x0: x });
      if (!spawned) break;
    }
  }

  function spawnWave() {
    const t = game.time;
    // 参考 PvZ 的波次预算：时间越久预算越高，高威胁单位占用更多预算。
    // 预算带一点随机波动，但高威胁单位有独立的冷却与保底，不会被随机数放大。
    const budget = Math.max(3.5, 3.5 + 7.5 * Math.min(1, t / 100)
      + (game.cycle - 1) * 1.5 + rand(-0.5, 0.5));
    let remaining = budget;
    let spawned = 0;
    const counts = {};
    game.waveIndex = (game.waveIndex || 0) + 1;
    game.waveBudget = budget;

    const highAlive = highThreatCount();
    let highSlots = Math.max(0, 2 - highAlive);
    let highThisWave = 0;
    let highReady = t >= game.nextHighThreatAt && highSlots > 0;
    // 保底：太久没有高威胁单位时，下一波强制优先选择高威胁。
    let pity = highSlots > 0 && t >= game.lastHighThreatAt + HIGH_THREAT_PITY;

    for (let step = 0; step < 12; step++) {
      const room = 16 - game.enemies.length;
      if (room <= 0 || remaining <= 0) break;
      let candidates = [];
      for (const kind of Object.keys(SPAWN_TABLE)) {
        const info = SPAWN_TABLE[kind];
        if (t < info.minTime) continue;
        if ((counts[kind] || 0) >= info.maxWave) continue;
        if (info.cost > remaining + 1e-6) continue;
        if (info.high && !(highReady || pity)) continue;
        candidates.push({ kind, info, weight: info.weight });
      }
      if (!candidates.length) break;
      // 母舰首只保底：只要它已解锁且预算足够，第一次高威胁机会优先给母舰，
      // 避免 100 秒 Boss 前它被炮台 / 哨兵完全挤掉。
      const carrierInfo = SPAWN_TABLE.carrier;
      if (!game.carrierSeen && highSlots > 0 && t >= carrierInfo.minTime
        && remaining >= carrierInfo.cost && (highReady || pity)) {
        candidates = [{ kind: 'carrier', info: carrierInfo, weight: carrierInfo.weight }];
      }
      if (pity) {
        const highOnly = candidates.filter(c => c.info.high);
        if (highOnly.length) candidates = highOnly;
      }

      let total = 0;
      for (const c of candidates) total += c.weight;
      let roll = Math.random() * total;
      let picked = candidates[candidates.length - 1];
      for (const c of candidates) {
        roll -= c.weight;
        if (roll <= 0) { picked = c; break; }
      }

      const info = picked.info;
      const maxByBudget = Math.floor((remaining + 1e-6) / info.cost);
      const n = Math.min(info.pack, info.maxWave - (counts[picked.kind] || 0),
        maxByBudget, room);
      if (n <= 0) break;

      spawnSpawnGroup(picked.kind, n);
      counts[picked.kind] = (counts[picked.kind] || 0) + n;
      remaining -= n * info.cost;
      spawned += n;

      if (info.high) {
        game.lastHighThreatAt = t;
        game.nextHighThreatAt = t + (info.cooldown || 9) + rand(-1.5, 1.5);
        highThisWave++;
        highSlots--;
        highReady = highSlots > 0 && highThisWave < 2;
        pity = false;
      }
    }

    if (spawned === 0 && game.enemies.length < 16) {
      spawnSpawnGroup('drone', 1);
    }
  }

  function updateEnemies(dt) {
    const p = game.player;
    const tier = game.difficulty.tier;
    for (let i = game.enemies.length - 1; i >= 0; i--) {
      const e = game.enemies[i];
      if (e.dead) { game.enemies.splice(i, 1); continue; }
      e.t += dt;
      e.age += dt;
      e.hitT = Math.max(0, e.hitT - dt);

      // 守点敌机到时主动向下退场；竖屏下也不会一直停在场上。
      if (e.leaveAt && e.age > e.leaveAt) {
        e.y += 120 * S * dt;
        const off = 90 * S;
        if (e.y > H + off || e.x < -off || e.x > W + off) {
          game.enemies.splice(i, 1);
        }
        continue;
      }

      if (e.kind === 'drone') {
        // 直线斜降：每架无人机有固定的小横向漂移，不再左右摆动。
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.fireT -= dt;
        if (e.fireT <= 0 && e.y > 16 * S && e.y < H * 0.72 && p && !p.dead) {
          // 航天协议：同轴等差弹速。轻松 1 发、标准 3 发、困难 5 发。
          ladderShot(e.x, e.y + 8 * S, [1, 3, 5][tier], 154 * S, 32 * S, '#fb7185', 'rice', 3.2 * S);
          e.fireT = rand(1.9, 2.9);
        }
      } else if (e.kind === 'weaver') {
        if (e.state === 'enter') {
          e.y += e.vy * dt;
          if (e.y >= e.targetY) { e.state = 'strafe'; e.vy = 0; }
        } else if (e.state === 'leave') {
          e.y += 120 * S * dt;
        } else {
          // 单向斜扫：进入后沿固定方向横移并缓慢下沉，方向清晰可预判。
          e.x += e.sweepDir * e.sweepSpeed * dt;
          e.y += 9 * S * dt;
          if (e.y > H * 0.72 || e.x < 30 * S || e.x > W - 30 * S) e.state = 'leave';
        }
        e.fireT -= dt;
        if (e.fireT <= 0 && (e.state === 'strafe' || e.state === 'enter') && e.y > 16 * S && e.y < H * 0.75 && p && !p.dead) {
          // 航天协议：快速自转星弹 + 延迟分裂的星弹拖尾。
          weaverVolley(e.x, e.y, tier);
          e.fireT = rand(2.6, 3.4);
        }
      } else if (e.kind === 'turret') {
        if (e.state === 'enter') {
          e.y += e.vy * dt;
          if (e.y >= e.targetY) { e.state = 'hold'; e.y = e.targetY; }
        } else {
          e.spin += dt * 0.7;
        }
        e.fireT -= dt;
        // 炮台一进入画面就可以开始第一轮齐射，不必等到完全落位。
        if (e.fireT <= 0 && e.y > 16 * S && e.y < H * 0.75 && p && !p.dead) {
          // 工业协议：向三个相隔 120° 的方向集中，每个方向 2 / 3 / 4 齿，
          // 每根齿包含完整层数，层间扇形顺逆交替。
          const angleDir = e.volley % 2 ? -1 : 1;
          turretVolley(e.x, e.y, tier, angleDir, e.spin);
          e.volley++;
          e.fireT = 2.6 + rand(-0.2, 0.3);
        }
        if (e.state === 'hold' && e.t > 16) e.y += 90 * S * dt;
      } else if (e.kind === 'lancer') {
        e.y += e.vy * dt;
        e.x += e.vx * dt;
        e.fireT -= dt;
        if (!e.fired && e.fireT <= 0 && e.y > 10 && e.y < H * 0.75 && p && !p.dead) {
          const count = [1, 3, 5][tier];
          ladderShot(e.x, e.y, count, 315 * S, 51 * S, '#fbbf24',
            count === 1 ? 'shard' : 'rice', count === 1 ? 3.8 * S : 3.2 * S);
          e.fired = true;
        }
      } else if (e.kind === 'sentinel') {
        if (e.state === 'enter') {
          e.y += e.vy * dt;
          if (e.y >= e.targetY) { e.state = 'hold'; e.y = e.targetY; }
        } else {
          e.spin += dt * 0.8;
          e.blinkT -= dt;
          if (e.blinkT <= 0) {
            spawnBurst(e.x, e.y, '#c4b5fd', 10, 90, 1.5);
            e.targetX = clamp(e.x + rand(-W * 0.2, W * 0.2), 40 * S, W - 40 * S);
            e.blinkT = rand(3.8, 5.2);
          }
          // 折跃到新的固定横坐标后停稳，不再上下漂浮。
          e.x += (e.targetX - e.x) * Math.min(1, dt * 4);
          e.y = e.targetY;
        }
        e.fireT -= dt;
        if (e.fireT <= 0 && (e.state === 'hold' || e.state === 'enter') && e.y > 16 * S && e.y < H * 0.75 && p && !p.dead) {
          // 软件协议：棱镜旋臂，4 / 8 / 12 条臂 × 8 / 10 / 12 层，方向交替。
          const angleDir = e.volley % 2 ? -1 : 1;
          spiralVolley(e.x, e.y, [4, 8, 12][tier], e.spin + e.volley * 0.23,
            120 * S, '#c4b5fd', '#67e8f9', 'orb', 3.8 * S,
            ENEMY_LAYER_COUNT[tier], 14 * S, LAYER_ANGLE_STEP[tier] * angleDir);
          e.volley++;
          e.fireT = 2.2;
        }
      } else if (e.kind === 'carrier') {
        if (e.state === 'enter') {
          e.y += e.vy * dt;
          if (e.y >= e.targetY) { e.state = 'hold'; e.y = e.targetY; }
        } else {
          // 母舰沿固定方向缓慢平移；每隔一段时间生成“新的一圈”僚机。
          e.x += e.driftDir * e.driftSpeed * dt;
          e.y = e.targetY;
          e.escortPhase += dt * 0.55 * e.escortDir;
          for (const ring of e.escortRings) {
            ring.age += dt;
            // 半径按对数速率增长：同一圈内保持一致，旧圈会比新圈更大。
            ring.radius = Math.min(120 * S,
              38 * S + Math.log(1 + ring.age * 0.35) * 56 * S);
          }
          e.escortT -= dt;
          if (e.escortT <= 0 && e.y < H * 0.75) {
            // 清掉已经全灭的旧圈，并最多保留两圈：外圈旧、内圈新。
            e.escortRings = e.escortRings.filter(ring => {
              const alive = game.enemies.some(w =>
                w.kind === 'wingman' && w.ring === ring && !w.dead);
              if (!alive) ring.dead = true;
              return alive;
            });
            while (e.escortRings.length >= 2) {
              const oldRing = e.escortRings.shift();
              oldRing.dead = true;
              for (const w of game.enemies) {
                if (w.kind === 'wingman' && w.ring === oldRing) {
                  w.dead = true;
                  spawnBurst(w.x, w.y, '#67e8f9', 2, 45, 1.2);
                }
              }
            }
            const ring = {
              id: ++e.escortRingId,
              age: 0,
              phase0: e.escortPhase + (e.escortRings.length % 2 ? Math.PI / e.escortTotal : 0),
              dir: e.escortDir,
              total: e.escortTotal,
              radius: 38 * S,
              dead: false
            };
            e.escortRings.push(ring);
            let summoned = 0;
            for (let slot = 0; slot < ring.total; slot++) {
              const a = ring.phase0 + (TAU * slot) / ring.total;
              const wx = e.x + Math.cos(a) * ring.radius;
              const wy = e.y + Math.sin(a) * ring.radius;
              if (spawnEnemy('wingman', wx, wy, { leader: e, ring, slot, force: true })) summoned++;
            }
            if (summoned > 0) {
              spawnBurst(e.x, e.y + 8 * S, '#67e8f9', 14, 120, 1.8);
              addRing(e.x, e.y, 8 * S, 66 * S, '#67e8f9', 0.5, 1.6);
            }
            e.escortT = 3.0 + rand(-0.3, 0.4);
          }
        }
      } else if (e.kind === 'wingman') {
        const leader = e.leader;
        const ring = e.ring;
        if (!leader || leader.dead || !ring || ring.dead) { e.dead = true; continue; }
        // 每圈内部共享年龄 / 半径，因此新圈从初始半径开始，旧圈在更大半径上。
        const a = ring.phase0 + ring.age * 0.55 * ring.dir
          + (TAU * e.slot) / ring.total;
        e.x = leader.x + Math.cos(a) * ring.radius;
        e.y = leader.y + Math.sin(a) * ring.radius;
        e.fireT -= dt;
        if (e.fireT <= 0 && e.y < H * 0.75 && p && !p.dead) {
          // 不瞄准玩家：向自身运动方向的前方 ±90° 均匀发射 3 / 6 / 9 发。
          const count = [3, 6, 9][tier];
          const moveAngle = a + ring.dir * Math.PI / 2;
          const speed = 118 * S;
          for (let i = 0; i < count; i++) {
            const shotAngle = moveAngle - Math.PI / 2 + (Math.PI * i) / (count - 1);
            addEnemyBullet(e.x, e.y, Math.cos(shotAngle) * speed, Math.sin(shotAngle) * speed,
              3.1 * S, '#67e8f9', 'rice');
          }
          e.fireT = rand(2.2, 3.0);
        }
      } else {
        // elite：观测者依次复现三系协议，进入后停在固定位置，读弹更清晰。
        if (e.state === 'enter') {
          e.y += e.vy * dt;
          if (e.y >= e.targetY) { e.state = 'fight'; e.y = e.targetY; }
        } else {
          e.x = e.x0;
          e.y = e.targetY;
        }
        e.fireT -= dt;
        if (e.fireT <= 0 && e.state === 'fight' && e.y < H * 0.75 && p && !p.dead) {
          const mode = e.volley % 3;
          if (mode === 0) {
            ladderShot(e.x, e.y, [1, 3, 5][tier], 152 * S, 34 * S, '#f5c96b', 'rice', 3.8 * S);
          } else if (mode === 1) {
            spiralVolley(e.x, e.y, [2, 4, 6][tier], e.t * 0.6,
              124 * S, '#67e8f9', '#c4b5fd', 'orb', 3.8 * S);
          } else {
            const ringCount = [10, 16, 22][tier];
            const gapWidth = [2.6, 2.1, 1.6][tier];
            radialGaps(e.x, e.y, ringCount, 92 * S, e.volley * 0.18,
              2, gapWidth, '#a78bfa', 'orb', 4.0 * S);
          }
          e.volley++;
          e.fireT = 1.55;
        }
      }

      const off = 90 * S;
      if (e.y > H + off || e.x < -off || e.x > W + off || e.age > 42) {
        game.enemies.splice(i, 1);
        continue;
      }

      if (p && !p.dead && p.inv <= 0) {
        const rr = e.r * 0.72 + p.r;
        if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
          hitPlayer(e.x, e.y);
          if (e.kind === 'drone') damageEnemy(e, 999, e.x, e.y);
        }
      }
    }
  }

  function damageEnemy(e, dmg, hx, hy) {
    if (!e || e.dead) return;
    e.hp -= dmg;
    e.hitT = 0.07;
    if (e.hp <= 0) {
      e.dead = true;
      game.kills++;
      const diff = game.difficulty;
      game.score += Math.round(e.score * diff.scoreMul);
      const p = game.player;
      const isBig = e.elite || e.kind === 'carrier';
      if (p) p.bomb = Math.min(100, p.bomb + (isBig ? 8 : 1.2) * PULSE_GAIN_MULT);
      const color = e.elite ? '#f5c96b'
        : e.kind === 'carrier' ? '#67e8f9'
          : e.kind === 'sentinel' ? '#c4b5fd'
            : e.kind === 'lancer' ? '#fbbf24' : '#fb7185';
      spawnBurst(e.x, e.y, color, isBig ? 28 : 8, isBig ? 200 : 95, isBig ? 2.4 : 1.5);
      addRing(e.x, e.y, 4 * S, (isBig ? 90 : 32) * S, color, 0.45, 1.5);
      game.shake = Math.max(game.shake, isBig ? 10 : 3);
      audio.explode(isBig);
      if (isBig) {
        addFloat(e.x, e.y, `+${Math.round(e.score * diff.scoreMul)}`, color, 11);
        spawnPickup(null, e.x, e.y, true);
      }
      updateHud(true);
    } else {
      spawnBurst(hx, hy, e.kind === 'elite' ? '#f5c96b' : '#fda4af', 2, 38, 1.2);
    }
  }

  /* ---------- boss ---------- */
  function createBoss() {
    const layerScale = game.mode === 'endless' ? 1 + (game.cycle - 1) * 0.24 : 1;
    const maxHp = 1420 * layerScale;
    return {
      x: W * 0.5,
      y: -120 * S,
      targetY: H * 0.285,
      r: 57 * S,
      hp: maxHp,
      maxHp,
      cycle: game.cycle,
      phase: 0,
      t: 0,
      entry: 3.6,
      invuln: 999,
      transition: 0,
      spellT: 0,
      fireT: 1.2,
      volley: 0,
      absorbCharge: 0,
      absorbTarget: [2, 1.5, 1][game.difficulty.tier],
      absorbPulse: 0,
      mode: 0,
      modeT: 0,
      spiralT: 0,
      spiralAngle: 0,
      spiralVel: 0.05,
      restAngle: 0,
      gearAngle: 0,
      gearVolley: 0,
      gearSpawned: false,
      armAngle: 0,
      armT: 0,
      hitT: 0,
      dead: false,
      deadT: 0,
      flash: 0
    };
  }


  function createMidboss() {
    const maxHp = Math.round(1420 / 3);
    return {
      isMidboss: true,
      name: '观察者',
      x: W * 0.5,
      y: -110 * S,
      targetY: H * 0.25,
      r: 38 * S,
      hp: maxHp,
      maxHp,
      phase: 0,
      t: 0,
      entry: 3.2,
      transition: 0,
      invuln: 999,
      fireT: 1.2,
      fanQueue: 0,
      fanDelay: 0,
      fanNext: 1,
      birdT: 1.2,
      birdSerial: 0,
      birdLane: 0,
      birdDir: 1,
      birdHalf: false,
      birdLanes: 9,
      spellT: 0.9,
      spellShown: false,
      hitT: 0,
      dead: false,
      deadT: 0,
      flash: 0
    };
  }

  function startMidboss() {
    if (game.midbossDone || game.boss) return;
    game.midbossDone = true;
    // 道中 Boss 占用第 31 波；击破后常规波次从第 32 波继续。
    game.waveIndex++;
    game.phase = 'midboss';
    game.boss = createMidboss();
    for (const e of game.enemies) spawnBurst(e.x, e.y, '#a78bfa', 4, 80, 1.2);
    game.enemies = [];
    for (const u of game.drops) spawnBurst(u.x, u.y, DISCIPLINES[u.type].color, 2, 50, 1);
    game.drops = [];
    hideKnowledge();
    clearEnemyBullets(true);
    el.bossUi.hidden = false;
    el.hud.classList.add('boss-active');
    showStage('道中 BOSS', '观察者', '笃实人能飞', 2800);
    game.shake = 14;
    game.warp = 0.55;
    audio.warning();
  }

  function startBoss() {
    if (game.bossSpawned) return;
    game.bossSpawned = true;
    game.phase = 'boss';
    game.boss = createBoss();
    for (const e of game.enemies) spawnBurst(e.x, e.y, '#fb7185', 4, 90, 1.4);
    game.enemies = [];
    for (const u of game.drops) spawnBurst(u.x, u.y, DISCIPLINES[u.type].color, 3, 60, 1.2);
    game.drops = [];
    hideKnowledge();
    clearEnemyBullets(true);
    el.bossUi.hidden = false;
    el.hud.classList.add('boss-active');
    if (game.mode === 'endless') {
      showBossBanner(`混沌核心 · 第 ${game.cycle} 次接入`, `深空第 ${game.cycle} 层 / 三系协议失序`);
    } else {
      showBossBanner();
    }
    game.shake = 20;
    game.warp = 0.9;
    audio.warning();
  }

  function advanceBossPhase(b, next) {
    b.phase = next;
    b.transition = 2.2;
    b.invuln = b.transition;
    b.mode = 0;
    b.modeT = 0;
    b.spellT = 0;
    b.fireT = 1.1;
    b.spiralT = 0;
    b.spiralVel = 0.05;
    b.restAngle = 0;
    b.gearAngle = 0;
    b.gearVolley = 0;
    b.gearSpawned = false;
    b.armAngle = 0;
    b.armT = 0;
    b.volley = 0;
    game.flash = Math.max(game.flash, 0.22);
    game.shake = 14;
    clearEnemyBullets(true);
    addRing(b.x, b.y, 30 * S, 260 * S, PHASE_COLORS[next], 0.85, 3);
    showSpellCard(next);
    audio.warning();
  }

  function showSpellCard(index) {
    const card = SPELL_CARDS[index] || SPELL_CARDS[0];
    showStage(`SPELL CARD ${['I', 'II', 'III'][index] || ''}`, card.name, card.sub, 2600);
  }

  function damageBoss(dmg, hx, hy) {
    const b = game.boss;
    if (!b || b.dead || b.entry || b.invuln > 0) return;
    b.hp -= dmg;
    b.hitT = 0.06;
    if (b.isMidboss) {
      spawnBurst(hx, hy, '#c4b5fd', 1, 45, 1);
      if (b.hp <= 0) defeatMidboss();
      return;
    }
    spawnBurst(hx, hy, PHASE_COLORS[b.phase], 1, 45, 1);
    const ratio = b.hp / b.maxHp;
    if (b.hp <= 0) {
      defeatBoss();
      return;
    }
    if (b.phase === 0 && ratio <= 0.66) advanceBossPhase(b, 1);
    else if (b.phase === 1 && ratio <= 0.33) advanceBossPhase(b, 2);
  }

  function defeatBoss() {
    const b = game.boss;
    if (!b || b.dead) return;
    b.hp = 0;
    b.dead = true;
    b.deadT = 0;
    b.invuln = 999;
    game.phase = 'boss-dead';
    const bonus = Math.round((game.mode === 'endless' ? 3200 + game.cycle * 1100 : 5000) * game.difficulty.scoreMul);
    game.score += bonus;
    game.kills++;
    addFloat(b.x, b.y, `+${fmtNum(bonus)}`, '#f5c96b', 18);
    game.shake = 26;
    game.flash = 0.6;
    game.slowT = 1.8;
    game.warp = 1;
    clearEnemyBullets(true);
    addRing(b.x, b.y, 20 * S, 380 * S, '#f5c96b', 1.2, 4);
    spawnBurst(b.x, b.y, '#f5c96b', 60, 300, 3);
    spawnBurst(b.x, b.y, '#fb7185', 40, 220, 2.4);
    audio.explode(true);
    setTimeout(() => audio.explode(true), 250);
    audio.setBgmMode('normal');
    el.bossUi.hidden = true;
    el.hud.classList.remove('boss-active');
    clearTimeout(stageTimer);
    el.stageBanner.hidden = true;
  }

  function resumeEndless() {
    const b = game.boss;
    const bx = b ? b.x : W * 0.5;
    const by = b ? b.y : H * 0.285;
    const p = game.player;
    game.boss = null;
    game.phase = 'combat';
    game.cycle++;
    game.nextBossAt = game.time + ENDLESS_BOSS_INTERVAL;
    game.nextEliteAt = game.time + 26;
    game.enemyScale = 1 + (game.cycle - 1) * 0.12;
    game.enemyBulletScale = 1 + Math.min(0.2, (game.cycle - 1) * 0.02);
    game.bossSpawned = false;

    if (p && !p.dead) {
      p.hp = Math.min(p.maxHp, p.hp + 1);
      p.shield = Math.min(p.maxShield, p.shield + 1);
      p.bomb = Math.min(100, p.bomb + 28);
      const px = clamp(p.x, W * 0.18, W * 0.82);
      const py = Math.max(H * 0.22, p.y - 130 * S);
      spawnPickup('aero', px - 48 * S, py);
      spawnPickup('code', px + 48 * S, py);
      spawnPickup('ie', px, py - 42 * S);
    } else {
      spawnPickup('aero', bx, by);
    }

    game.score += 1200 + game.cycle * 400;
    game.flash = Math.max(game.flash, 0.22);
    game.warp = 0.8;
    game.shake = 10;
    showStage(`DEEP LAYER ${pad2(game.cycle)}`, `深空第 ${game.cycle} 层`,
      '核心已击退 · 熵增强度上升 · 70 秒后再次接入', 3600);
    audio.setBgmMode('normal');
    [392, 493.88, 587.33].forEach((n, i) => audio.tone(n, 0.45, 'sine', 0.04, n, i * 0.09));
    updateHud(true);
  }

  function openPortal() {
    game.boss = null;
    game.phase = 'final';
    game.portal = {
      x: W * 0.5,
      y: H * 0.16,
      r: 43 * S,
      t: 0
    };
    game.score += Math.round(1200 * game.difficulty.scoreMul);
    showStage('终点已定位', '跃迁门', '向上穿越跃迁门 · 抵达终点', 4600);
    showHint('向上穿越跃迁门 · 抵达终点', 999);
    game.warp = 0.55;
    audio.setBgmMode('normal');
    [523.25, 659.25, 783.99].forEach((n, i) => audio.tone(n, 0.5, 'sine', 0.035, n, i * 0.1));
    updateHud(true);
  }


  /* ---------- midboss ---------- */
  function midbossStarFan(b, ring = 0) {
    const p = game.player;
    if (!p || p.dead) return;
    const base = Math.atan2(p.y - b.y, p.x - b.x);
    const count = 13;
    const step = Math.PI / 18; // 10°
    const speed = (132 + ring * 32) * S;
    const color = ring === 0
      ? (game.difficulty.tier === 0 ? '#f5c96b' : '#c4b5fd')
      : '#f5c96b';
    for (let i = 0; i < count; i++) {
      const a = base - step * 6 + step * i;
      addEnemyBullet(b.x, b.y, Math.cos(a) * speed, Math.sin(a) * speed,
        7 * S, i % 2 ? color : '#f5c96b', 'star', {
          spin: 1.4,
          life: 7
        });
    }
    game.shake = Math.max(game.shake, 1.5);
    audio.enemyShoot();
  }

  function spawnBird(x, y, color) {
    const wingHalf = 27.6 * S;
    const wingH = 18 * S;
    const tailHalf = 4.4 * S;
    const tailH = 19.2 * S;
    const tier = game.difficulty.tier;
    // 尾巴指向上方很远处的一点，使鸟身略微倾斜；配合横向加速度形成小弧度。
    const focalX = W * 0.5;
    const focalY = -H * 1.6;
    const rot = Math.atan2(focalY - y, focalX - x) + Math.PI / 2;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    // 从上方同一个远焦点向两侧散开：横向加速度朝屏幕外侧。
    const ax = (x - focalX) * 0.18;
    const place = (lx, ly) => [x + lx * cos - ly * sin, y + lx * sin + ly * cos];
    for (let i = 0; i < 9; i++) {
      const u = (i - 4) / 4;
      const extra = {
        life: Infinity,
        accelerating: true,
        ax,
        ay: 184 * S,
        birdFormation: true
      };
      const wing = place(u * wingHalf, -Math.abs(u) * wingH);
      addEnemyBullet(wing[0], wing[1], 0, 28 * S, 3 * S, color, 'star', extra);
      const tail = place(u * tailHalf, -8.4 * S - Math.abs(u) * tailH);
      addEnemyBullet(tail[0], tail[1], 0, 28 * S, 3 * S, '#e9d5ff', 'star', {
        life: Infinity,
        accelerating: true,
        ax,
        ay: 184 * S,
        birdFormation: true
      });
    }
  }

  function spawnBirdNext(b) {
    // 竖屏宽度较窄时减少轨道数，避免鸟在 x 方向挤在一起。
    const span = W * 0.72;
    const minGap = 50 * S;
    const lanes = clamp(Math.floor(span / minGap) + 1, 3, 9);
    if (b.birdLanes !== lanes) {
      b.birdLanes = lanes;
      b.birdHalf = false;
      b.birdLane = 0;
      b.birdDir = 1;
    }
    const step = span / (lanes - 1);
    const minX = W * 0.14;
    let x;
    if (!b.birdHalf) {
      x = minX + step * b.birdLane;
      b.birdLane++;
      if (b.birdLane >= lanes) {
        // 折返：从右到左走相邻正向轨道的中间位置。
        b.birdHalf = true;
        b.birdLane = lanes - 2;
        b.birdDir = -1;
      }
    } else {
      x = minX + step * (b.birdLane + 0.5);
      b.birdLane--;
      if (b.birdLane < 0) {
        b.birdHalf = false;
        b.birdLane = 0;
        b.birdDir = 1;
      }
    }
    const y = -18 * S - rand(0, 30) * S;
    spawnBird(x, y, b.birdSerial++ % 2 ? '#f5c96b' : '#c4b5fd');
  }

  function defeatMidboss() {
    const b = game.boss;
    if (!b || b.dead) return;
    b.hp = 0;
    b.dead = true;
    b.deadT = 0;
    b.invuln = 999;
    game.phase = 'midboss-dead';
    const bonus = Math.round(2600 * game.difficulty.scoreMul);
    game.score += bonus;
    game.kills++;
    addFloat(b.x, b.y, `+${fmtNum(bonus)}`, '#f5c96b', 16);
    game.shake = 22;
    game.flash = 0.45;
    game.slowT = 0.8;
    clearEnemyBullets(true);
    addRing(b.x, b.y, 18 * S, 300 * S, '#c4b5fd', 0.9, 3);
    spawnBurst(b.x, b.y, '#c4b5fd', 45, 240, 2.6);
    spawnBurst(b.x, b.y, '#f5c96b', 25, 180, 2);
    audio.explode(true);
  }

  function endMidboss() {
    game.boss = null;
    game.spawnT = Math.min(game.spawnT, 2.0);
    game.phase = 'combat';
    el.bossUi.hidden = true;
    el.hud.classList.remove('boss-active');
    showStage('道中击破', '观察者', '航段继续 · 核心信号仍在逼近', 2600);
    updateHud(true);
  }

  function updateMidboss(b, dt) {
    b.t += dt;
    b.hitT = Math.max(0, b.hitT - dt);
    b.flash = Math.max(0, b.flash - dt * 4);

    if (b.dead) {
      b.deadT += dt;
      b.y += 12 * S * dt;
      if (Math.random() < 0.45) {
        spawnBurst(b.x + rand(-28, 28) * S, b.y + rand(-24, 24) * S,
          Math.random() > 0.5 ? '#c4b5fd' : '#f5c96b', randInt(1, 4), 120, 1.8);
      }
      if (b.deadT > 2.2) endMidboss();
      return;
    }

    if (b.entry > 0) {
      b.entry -= dt;
      const t = 1 - Math.max(0, b.entry) / 3.2;
      b.x = W * 0.5;
      b.y = lerp(-110 * S, b.targetY, 1 - Math.pow(1 - t, 3));
      b.invuln = 999;
      b.flash = 0.2;
      if (b.entry <= 0) {
        b.entry = 0;
        b.invuln = 0;
        b.fireT = 1.0;
        b.birdT = 1.2;
        b.spellT = 0.8;
        game.shake = 14;
        game.warp = 0.45;
        addRing(b.x, b.y, 18 * S, 260 * S, '#c4b5fd', 0.8, 2.5);
      }
      return;
    }

    // 不左右摇晃：固定在屏幕中线上。
    b.x = W * 0.5;
    b.y = b.targetY;

    const p = game.player;
    if (!p || p.dead) return;

    if (b.spellT > 0) {
      b.spellT -= dt;
      if (b.spellT <= 0 && !b.spellShown) {
        b.spellShown = true;
        showStage('SPELL CARD', '笃实人能飞', '道中观察者 · 星羽坠落', 2800);
        audio.warning();
      }
    }

    if (b.fanQueue > 0) {
      b.fanDelay -= dt;
      if (b.fanDelay <= 0) {
        midbossStarFan(b, b.fanNext);
        b.fanNext++;
        b.fanQueue--;
        b.fanDelay = 0.12;
      }
    }

    b.fireT -= dt;
    if (b.fireT <= 0) {
      midbossStarFan(b, 0);
      b.fanNext = 1;
      b.fanQueue = [0, 1, 2][game.difficulty.tier];
      b.fanDelay = 0.12;
      b.fireT = 1.15;
    }

    b.birdT -= dt;
    if (b.birdT <= 0) {
      spawnBirdNext(b);
      b.birdT = 0.25;
    }
  }

  function absorbRing(b, tune, tier) {
    const count = tune.ringCount;
    const layers = BOSS_LAYER_COUNT[tier];
    const total = count * layers;
    const value = 1 / total;
    const radius = Math.hypot(W, H) * 0.8 + 40 * S;
    const angleDir = b.volley % 2 ? -1 : 1;
    for (let l = 0; l < layers; l++) {
      const speed = 106 * S + l * 20 * S;
      const layerAngle = b.volley * 0.17 + l * LAYER_ANGLE_STEP[tier] * angleDir;
      for (let i = 0; i < count; i++) {
        const a = layerAngle + (TAU * i) / count;
        addEnemyBullet(
          b.x + Math.cos(a) * radius,
          b.y + Math.sin(a) * radius,
          -Math.cos(a) * speed,
          -Math.sin(a) * speed,
          7 * S, '#f5c96b', 'star', {
            life: 12,
            spin: 2,
            bossAbsorb: true,
            absorbValue: value
          }
        );
      }
    }
    game.shake = Math.max(game.shake, 1.5);
    audio.enemyShoot();
  }

  function fireBossBigStar(b) {
    const p = game.player;
    if (!p || p.dead) return;
    const a = Math.atan2(p.y - b.y, p.x - b.x);
    const speed = 160 * S;
    addEnemyBullet(b.x, b.y, Math.cos(a) * speed, Math.sin(a) * speed,
      12 * S, '#f5c96b', 'star', {
        life: Infinity,
        spin: 1.6,
        bigStar: true,
        trailT: 0.04,
        trailInterval: 0.07,
        trailLife: 0.8
      });
    b.absorbPulse = 1;
    game.shake = Math.max(game.shake, 5);
    addRing(b.x, b.y, 12 * S, 100 * S, '#f5c96b', 0.55, 2);
    audio.enemyShoot();
  }

  function spawnGearFormation(b) {
    const group = {
      x: b.x,
      y: b.y,
      angle: game.player && !game.player.dead
        ? Math.atan2(game.player.y - b.y, game.player.x - b.x) : 0,
      state: 'move',
      timer: 0.65,
      pause: 0.35,
      move: 0.65,
      speed: 120 * S,
      spin: 0,
      members: []
    };
    game.gearFormation = group;
    const addOrb = (ox, oy, rotates = false) => {
      const bullet = addEnemyBullet(group.x + ox, group.y + oy, 0, 0,
        3 * S, '#b9b9c9', 'orb', { life: Infinity, gearOffset: { x: ox, y: oy } });
      bullet.gearGroup = group;
      if (rotates) {
        bullet.gearRotates = true;
        bullet.gearRadius = Math.hypot(ox, oy);
        bullet.gearAngle = Math.atan2(oy, ox);
      }
      group.members.push(bullet);
    };
    // 中心 1 颗。
    addOrb(0, 0);
    // 次中心 6 颗。
    const ringR = 9 * S;
    for (let i = 0; i < 6; i++) {
      const a = (TAU * i) / 6;
      addOrb(Math.cos(a) * ringR, Math.sin(a) * ringR, true);
    }
    // 演示图案只覆盖 2.25 个齿（9 列 = 2×4 列 + 1 列）。
    // 整体为 6 齿，因此把每行 4 列的齿形重复 6 次，共 24 列。
    // A = 玉弹，B = 空白。
    const toothRows = [
      { pattern: 'ABAA', radius: 34 * S },
      { pattern: 'ABAB', radius: 41 * S },
      { pattern: 'AAAB', radius: 48 * S }
    ];
    const teeth = 6;
    const colsPerTooth = 4;
    const totalCols = teeth * colsPerTooth;
    for (const row of toothRows) {
      for (let tooth = 0; tooth < teeth; tooth++) {
        for (let c = 0; c < colsPerTooth; c++) {
          if (row.pattern[c] !== 'A') continue;
          const col = tooth * colsPerTooth + c;
          const a = (TAU * col) / totalCols;
          addOrb(Math.cos(a) * row.radius, Math.sin(a) * row.radius, true);
        }
      }
    }
  }

  function updateGearFormation(dt) {
    const g = game.gearFormation;
    if (!g) return;
    const p = game.player;
    g.timer -= dt;
    if (g.timer <= 0) {
      if (g.state === 'move') {
        // 移动结束：立即更新瞄准，然后进入停顿。
        if (p && !p.dead) g.angle = Math.atan2(p.y - g.y, p.x - g.x);
        g.state = 'pause';
        g.timer = g.pause;
      } else {
        g.state = 'move';
        g.timer = g.move;
      }
    }
    if (g.state === 'move' && g.angle !== null) {
      g.x += Math.cos(g.angle) * g.speed * dt;
      g.y += Math.sin(g.angle) * g.speed * dt;
      // 每次追击时外圈与次外圈相对圆心顺时针转 60°。
      g.spin -= (Math.PI / 3) / g.move * dt;
    }
    for (const m of g.members) {
      if (m.gearRotates) {
        const a = m.gearAngle + g.spin;
        m.x = g.x + Math.cos(a) * m.gearRadius;
        m.y = g.y + Math.sin(a) * m.gearRadius;
      } else {
        m.x = g.x + m.gearOffset.x;
        m.y = g.y + m.gearOffset.y;
      }
    }
    const margin = 140 * S;
    if (g.x < -margin || g.x > W + margin || g.y < -margin || g.y > H + margin) {
      for (const m of g.members) m.life = 0;
      game.gearFormation = null;
    }
  }

  function phase3Volley(b, tier) {
    const groups = 3;
    const teeth = [2, 3, 4][tier];
    const layers = ENEMY_LAYER_COUNT[tier];
    const toothStep = (20 * Math.PI) / 180;
    const layerStep = (5.5 * Math.PI) / 180;
    const midT = (teeth - 1) / 2;
    const midL = (layers - 1) / 2;
    const angleDir = b.gearVolley % 2 ? -1 : 1;
    b.gearVolley++;
    for (let g = 0; g < groups; g++) {
      const groupAngle = b.gearAngle + (TAU * g) / groups;
      for (let t = 0; t < teeth; t++) {
        const tooth = groupAngle + (t - midT) * toothStep;
        for (let l = 0; l < layers; l++) {
          const a = tooth + (l - midL) * layerStep * angleDir;
          const speed = (48 + l * 6.5) * S;
          addEnemyBullet(b.x, b.y, Math.cos(a) * speed, Math.sin(a) * speed,
            4.2 * S, '#c4b5fd', 'orb', { life: Infinity });
        }
      }
    }
    b.gearAngle += 0.34;
    addRing(b.x, b.y, 10 * S, 80 * S, '#c4b5fd', 0.45, 1.5);
  }

  function updateBoss(dt) {
    const b = game.boss;
    if (!b) return;
    if (b.isMidboss) { updateMidboss(b, dt); return; }
    b.t += dt;
    b.hitT = Math.max(0, b.hitT - dt);
    b.flash = Math.max(0, b.flash - dt * 4);

    if (b.dead) {
      b.deadT += dt;
      b.y += 12 * S * dt;
      b.x += Math.sin(b.deadT * 7) * 20 * S * dt;
      if (Math.random() < 0.55) {
        spawnBurst(b.x + rand(-40, 40) * S, b.y + rand(-28, 28) * S,
          Math.random() > 0.5 ? '#f5c96b' : '#fb7185', randInt(2, 6), 150, 2);
        if (Math.random() < 0.2) audio.explode(false);
      }
      game.shake = Math.max(game.shake, 4);
      if (b.deadT > 2.35) {
        if (game.mode === 'endless') resumeEndless();
        else openPortal();
      }
      return;
    }

    if (b.entry > 0) {
      b.entry -= dt;
      const t = 1 - Math.max(0, b.entry) / 3.6;
      b.y = lerp(-120 * S, b.targetY, 1 - Math.pow(1 - t, 3));
      b.invuln = 999;
      b.flash = 0.2;
      if (b.entry <= 0) {
        b.entry = 0;
        b.invuln = 0;
        b.fireT = 1.1;
        b.spellT = 1.1;
        game.shake = 18;
        game.warp = 0.5;
        audio.setBgmMode('boss');
        addRing(b.x, b.y, 20 * S, 300 * S, '#f5c96b', 0.9, 3);
      }
      return;
    }

    if (b.transition > 0) {
      b.transition -= dt;
      b.invuln = Math.max(0, b.transition);
      b.y = b.targetY + Math.sin(b.t * 9) * 5 * S;
      if (b.transition <= 0) {
        b.invuln = 0;
        b.fireT = 0.8;
        b.mode = 0;
        b.modeT = 0;
      }
      return;
    }

    if (b.phase === 0) {
      b.x = W * 0.5;
      b.y = b.targetY;
    } else {
      b.x = W * 0.5 + Math.sin(b.t * 0.58) * Math.min(W * 0.25, 168 * S);
      b.y = b.targetY + Math.sin(b.t * 1.4) * 9 * S;
    }

    const p = game.player;
    if (!p || p.dead) return;

    const tune = BOSS_TUNING[game.difficulty.key] || BOSS_TUNING.normal;
    const tier = game.difficulty.tier;

    if (b.spellT > 0) {
      b.spellT -= dt;
      if (b.spellT <= 0) showSpellCard(b.phase);
    }

    if (b.phase === 0) {
      b.fireT -= dt;
      if (b.fireT <= 0) {
        // 航天协议：星弹从画面外被吸向 Boss，碰到 Boss 后转化为吸收进度。
        absorbRing(b, tune, tier);
        b.volley++;
        b.fireT = 1.45;
      }
    } else if (b.phase === 1) {
      b.modeT += dt;
      if (b.mode === 0) {
        b.spiralT -= dt;
        if (b.spiralT <= 0) {
          // 软件协议：旋臂数量随难度增加，角速度逐渐加快。
          spiralVolley(b.x, b.y, tune.spiralArms, b.spiralAngle,
            220.8 * S, '#67e8f9', '#a5f3fc', 'orb', 4 * S);
          b.spiralAngle += b.spiralVel;
          b.spiralVel += 0.002;
          b.spiralT += 0.0354;
        }
        if (b.modeT > 7.2) {
          b.mode = 1;
          b.modeT = 0;
          b.fireT = 0.4;
          b.restAngle = 0;
          b.spiralT = 0;
        }
      } else {
        b.fireT -= dt;
        if (b.fireT <= 0) {
          // 短暂休息：Boss 发射一圈没有大缺口的均匀弹幕。
          const restLayers = [1, 2, 3][tier];
          radialShot(b.x, b.y, 45, 90 * S, b.restAngle,
            '#c4b5fd', 'orb', 4 * S, restLayers, 10 * S,
            (TAU / 45) / restLayers);
          b.restAngle += 0.18;
          b.fireT = 2.0;
          audio.enemyShoot();
        }
        if (b.modeT > 1.05) {
          b.mode = 0;
          b.modeT = 0;
          b.spiralT = 0;
          // 休息结束后保留当前角速度，继续加速。
        }
      }
    } else {
      if (!b.gearSpawned) {
        b.gearSpawned = true;
        spawnGearFormation(b);
        b.fireT = 1.2;
      }
      b.fireT -= dt;
      if (b.fireT <= 0) {
        // 工业协议：三向炮台式齐射，持续发射；开局齿轮编队会追击玩家。
        phase3Volley(b, tier);
        b.fireT = 1.5;
        audio.enemyShoot();
      }
    }

    if (dist2(b.x, b.y, p.x, p.y) < (b.r * 0.8 + p.r) * (b.r * 0.8 + p.r)) {
      hitPlayer(b.x, b.y);
    }
  }

  function radialGaps(x, y, count, speed, offset, gapCount, gapWidth, color, type = 'orb', radius = 4.2 * S, layers = 1, speedStep = 0, fanSpread = 0, gapOffset = null) {
    const step = TAU / count;
    const gapBase = gapOffset === null ? offset : gapOffset;
    const gapCenters = [];
    for (let g = 0; g < gapCount; g++) gapCenters.push(gapBase + (TAU * g) / gapCount + 0.35);
    const halfGap = step * gapWidth * 0.5;
    const mid = (layers - 1) / 2;
    // 每一根“齿”都包含完整的 layers 层子弹，整根齿要么保留、要么落入缺口，
    // 这样不会出现某个方向只剩一层、或者齿列参差不齐的情况。
    const fanStep = layers > 1 ? (step * fanSpread) / Math.max(1, layers - 1) : 0;
    for (let i = 0; i < count; i++) {
      const base = offset + step * i;
      let inGap = false;
      for (const gc of gapCenters) {
        const delta = Math.abs(Math.atan2(Math.sin(base - gc), Math.cos(base - gc)));
        if (delta < halfGap) { inGap = true; break; }
      }
      if (inGap) continue;
      for (let layer = 0; layer < layers; layer++) {
        const a = base + (layer - mid) * fanStep;
        const layerSpeed = speed + layer * speedStep;
        addEnemyBullet(x, y, Math.cos(a) * layerSpeed, Math.sin(a) * layerSpeed, radius, color, type);
      }
    }
    addRing(x, y, 10 * S, 75 * S, color, 0.45, 1.5);
  }

  function clearEnemyBullets(withParticles = false) {
    if (withParticles) {
      for (const b of game.eBullets) {
        spawnBurst(b.x, b.y, b.color, 1, 35, 1.2);
      }
    }
    game.eBullets = [];
    game.gearFormation = null;
  }

  /* ---------- pickups ---------- */
  function spawnPickup(type = null, x = null, y = null, fromElite = false) {
    if (!type) {
      const cycle = ['aero', 'code', 'ie'];
      type = fromElite ? pick(cycle) : cycle[game.pickupCycle % 3];
      if (!fromElite) game.pickupCycle++;
    }
    const px = x === null ? rand(W * 0.16, W * 0.84) : x;
    const py = y === null ? -28 * S : y;
    game.drops.push({
      type,
      x: px,
      y: py,
      age: 0,
      t: rand(0, TAU),
      r: 14 * S,
      vy: 57 * S,
      dead: false
    });
  }

  function collectPickup(drop) {
    const p = game.player;
    if (!p || drop.dead) return;
    drop.dead = true;
    game.pickups++;
    const type = drop.type;
    const info = DISCIPLINES[type];
    let gain = '';

    if (type === 'aero') {
      if (p.fireLvl < 5) {
        p.fireLvl++;
        gain = `火力系统 Lv.${p.fireLvl} · 僚机 ${wingmanCount(p.fireLvl)}`;
      } else {
        p.bomb = Math.min(100, p.bomb + 28);
        gain = '火力已满 · 脉冲充能 +28%';
      }
    } else if (type === 'code') {
      if (p.codeLvl < 5) {
        p.codeLvl++;
        p.shield = Math.min(p.maxShield, p.shield + 1);
        gain = '算法护盾 +1';
      } else {
        p.shield = p.maxShield;
        p.bomb = Math.min(100, p.bomb + 18);
        gain = '算法已满 · 护盾回充';
      }
    } else {
      if (p.ieLvl < 5) {
        p.ieLvl++;
        p.bomb = Math.min(100, p.bomb + 16);
        gain = `机动效率 Lv.${p.ieLvl} · 脉冲 +16%`;
      } else {
        p.bomb = Math.min(100, p.bomb + 22);
        gain = '效率已满 · 脉冲充能 +22%';
      }
    }

    game.score += Math.round((90 + game.pickups * 12) * game.difficulty.scoreMul);
    game.bombCount = Math.max(game.bombCount, 0);
    spawnBurst(drop.x, drop.y, info.color, 24, 170, 1.9);
    addRing(drop.x, drop.y, 6 * S, 72 * S, info.color, 0.6, 2);
    addFloat(drop.x, drop.y - 10 * S, `+${info.label}`, info.color, 10);
    showKnowledge(type, gain);
    audio.pickup(type);
    updateHud(true);
  }

  function updatePickups(dt) {
    const p = game.player;
    for (let i = game.drops.length - 1; i >= 0; i--) {
      const u = game.drops[i];
      u.age += dt;
      u.t += dt * 2.2;
      u.y += u.vy * dt;
      u.x += Math.sin(u.t * 0.7) * 12 * S * dt;
      if (p && !p.dead) {
        const dx = p.x - u.x;
        const dy = p.y - u.y;
        const d = Math.hypot(dx, dy);
        const magnet = u.age > 4.5 ? 310 * S : 152 * S;
        if (d < magnet && d > 0.01) {
          const pull = (1 - d / magnet) * 340 * S + 100 * S;
          u.x += (dx / d) * pull * dt;
          u.y += (dy / d) * pull * dt;
        }
        if (d < p.pickupR + u.r + 7 * S) {
          collectPickup(u);
          game.drops.splice(i, 1);
          continue;
        }
      }
      if (u.y > H + 50 || u.dead) game.drops.splice(i, 1);
    }
  }

  /* ---------- particles / fx ---------- */
  function spawnBurst(x, y, color, count, speed, size) {
    if (game.particles.length > 520) {
      game.particles.splice(0, game.particles.length - 500);
    }
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const v = rand(speed * 0.25, speed);
      game.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: rand(0.25, 0.8),
        max: 0.8,
        size: rand(0.7, size) * S,
        color,
        drag: rand(0.9, 0.97),
        glow: Math.random() > 0.45
      });
    }
  }

  function addRing(x, y, r, maxR, color, life = 0.6, width = 2) {
    if (game.rings.length > 30) game.rings.shift();
    game.rings.push({ x, y, r, maxR, color, life, max: life, width: width * S });
  }

  function addFloat(x, y, text, color, size = 10) {
    if (game.floats.length > 30) game.floats.shift();
    game.floats.push({ x, y, text, color, size: size * S, life: 1.1, max: 1.1, vy: -34 * S });
  }

  function updateEffects(dt) {
    const ps = game.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      if (p.life <= 0) ps.splice(i, 1);
    }
    const rs = game.rings;
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i];
      r.life -= dt;
      r.r += (r.maxR - r.r) * Math.min(1, dt * 5.5);
      if (r.life <= 0) rs.splice(i, 1);
    }
    const fs = game.floats;
    for (let i = fs.length - 1; i >= 0; i--) {
      const f = fs[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) fs.splice(i, 1);
    }
    game.shake = Math.max(0, game.shake - dt * 42);
    game.flash = Math.max(0, game.flash - dt * 2.4);
    game.slowT = Math.max(0, game.slowT - dt);
  }

  /* ---------- bomb ---------- */
  function useBomb() {
    if (game.scene !== 'playing' || game.paused || game.phase === 'ending' || game.phase === 'final') return;
    const p = game.player;
    if (!p || p.dead || p.bomb < 100) return;
    p.bomb = 0;
    p.inv = Math.max(p.inv, 5);
    game.bombCount++;
    game.flash = 0.75;
    game.shake = 24;
    game.slowT = 1.7;
    game.warp = 0.8;
    addRing(p.x, p.y, 20 * S, Math.max(W, H) * 0.9, '#67e8f9', 1.0, 5);
    addRing(p.x, p.y, 10 * S, Math.max(W, H) * 0.55, '#c4b5fd', 0.8, 3);
    spawnBurst(p.x, p.y, '#a5f3fc', 55, 420, 2.8);
    // 鸟形编队与齿轮编队免疫脉冲消弹；其余弹幕正常清除。
    const kept = [];
    for (const b of game.eBullets) {
      if (b.birdFormation || b.gearGroup) {
        kept.push(b);
        continue;
      }
      game.score += 3 * game.difficulty.scoreMul;
      spawnBurst(b.x, b.y, b.color, 1, 75, 1.4);
    }
    game.eBullets = kept;
    // 笃实脉冲只清除敌弹并伤害 Boss，不再直接伤害普通敌机。
    if (game.boss && !game.boss.dead) damageBoss(165, game.boss.x, game.boss.y);
    addFloat(p.x, p.y - 46 * S, '笃实脉冲', '#67e8f9', 16);
    audio.bomb();
    updateHud(true);
  }

  /* ---------- update ---------- */
  function update(dt) {
    if (game.scene !== 'playing' || game.paused) return;

    if (game.phase === 'ending') {
      game.endT -= dt;
      updateStars(dt);
      updateEffects(dt);
      updateHud();
      if (game.endT <= 0) showResult(game.endWin);
      return;
    }

    game.time += dt;
    game.warp = Math.max(0, game.warp - dt * 0.9);
    updateStars(dt);

    const slow = game.slowT > 0 ? 0.48 : 1;
    const edt = dt * slow;

    updatePlayer(dt);
    updatePlayerBullets(dt);
    updateEnemies(edt);
    updateEnemyBullets(edt);
    updateBoss(edt);
    updatePickups(dt);
    updateEffects(dt);

    if (game.knowledgeT > 0) {
      game.knowledgeT -= dt;
      if (game.knowledgeT <= 0) hideKnowledge();
    }
    if (game.hintT > 0 && game.phase !== 'final') {
      game.hintT -= dt;
      if (game.hintT <= 0) hideHint();
    }

    if (game.phase === 'combat') {
      updateSpawner(dt);
    }

    if (game.phase === 'final' && game.portal) {
      game.portal.t += dt;
      const p = game.player;
      if (p && !p.dead) {
        if (Math.random() < 0.5) {
          spawnBurst(
            game.portal.x + rand(-10, 10) * S,
            game.portal.y + rand(-6, 6) * S,
            Math.random() > 0.5 ? '#67e8f9' : '#a78bfa', 1, 50, 1.3
          );
        }
        if (dist2(p.x, p.y, game.portal.x, game.portal.y) < (game.portal.r + p.pickupR + 8 * S) ** 2) {
          endRun(true);
        }
      }
    }

    // Combat-only pulse charge; explicit pickups and layer rewards are unchanged.
    if (game.player && !game.player.dead && game.phase !== 'final') {
      game.player.bomb = Math.min(100, game.player.bomb + dt * 0.38 * PULSE_GAIN_MULT);
    }

    hudAccumulator += dt;
    if (hudAccumulator > 0.07) {
      hudAccumulator = 0;
      updateHud();
    }
  }

  function updateSpawner(dt) {
    if (game.mode === 'campaign') {
      if (!game.stage2 && game.time >= STAGE2_TIME) {
        game.stage2 = true;
        showStage('航段 02', '碎片带', '熵增舰队密度上升 · 保持机动', 2600);
      }
      if (!game.stage3 && game.time >= STAGE3_TIME) {
        game.stage3 = true;
        showStage('航段 03', '混沌边界', '核心信号逼近 · 准备接敌', 2600);
      }
      // 固定波次：第31波道中 Boss，第61波最终 Boss。
      if (!game.midbossDone && game.waveIndex + 1 >= MIDBOSS_WAVE) {
        startMidboss();
        return;
      }
      if (game.waveIndex + 1 >= CAMPAIGN_BOSS_WAVE) {
        startBoss();
        return;
      }
    } else if (game.time >= game.nextBossAt) {
      startBoss();
      return;
    }

    game.spawnT -= dt;
    if (game.spawnT <= 0) {
      spawnWave();
      // 道中 Boss 前 3 秒一波；道中击破后加快为 2 秒一波。
      game.spawnT = game.mode === 'campaign' && game.midbossDone ? 2.0 : 3.0;
    }

    if (ELITE_ENABLED) {
      if (game.mode === 'campaign') {
        const eliteTimes = [24, 52, 80];
        if (game.eliteT < eliteTimes.length && game.time >= eliteTimes[game.eliteT]) {
          const ex = W * rand(0.35, 0.65);
          const elite = spawnEnemy('elite', ex, -55 * S, { x0: ex, force: true });
          if (elite) {
            showStage('ELITE SIGNAL', '观测者', '高能目标出现 · 击毁可获得额外徽章', 2300);
            game.eliteT++;
          }
        }
      } else if (game.time >= game.nextEliteAt) {
        const ex = W * rand(0.35, 0.65);
        const elite = spawnEnemy('elite', ex, -55 * S, { x0: ex, force: true });
        if (elite) {
          showStage('ELITE SIGNAL', `观测者 · 深空 ${game.cycle}`, '高能目标出现 · 击毁可获得额外徽章', 2300);
          game.nextEliteAt = game.time + 32;
        }
      }
    }

    game.pickupT -= dt;
    if (game.pickupT <= 0) {
      spawnPickup();
      game.pickupT = 9.0 + rand(-0.6, 0.6);
    }
  }

  function updateAmbient(dt) {
    if (game.paused) return;
    updateStars(dt * (game.scene === 'title' ? 0.6 : 0.4));
    if (game.scene === 'result') {
      updateEffects(dt * 0.45);
      if (game.player) {
        game.player.tilt *= 0.96;
      }
    }
  }

  /* ---------- render ---------- */
  const spriteCache = new Map();

  function glowSprite(color) {
    if (spriteCache.has(color)) return spriteCache.get(color);
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 31);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.16, color);
    grad.addColorStop(0.48, hexToRgba(color, 0.42));
    grad.addColorStop(1, hexToRgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    spriteCache.set(color, c);
    return c;
  }

  // 星弹使用预渲染精灵，避免每帧为几十上百颗星弹重复做路径 + shadowBlur，
  // 同时保证星体足够大、足够实心。
  const starSpriteCache = new Map();
  function starSprite(color) {
    if (starSpriteCache.has(color)) return starSpriteCache.get(color);
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.translate(48, 48);
    g.shadowColor = color;
    g.shadowBlur = 12;
    g.fillStyle = color;
    g.beginPath();
    g.arc(0, 0, 18, 0, TAU);
    g.fill();
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (TAU * k) / 8;
      const rr = k % 2 ? 14 : 32;
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      if (k === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,.96)';
    g.beginPath();
    g.arc(0, 0, 10, 0, TAU);
    g.fill();
    starSpriteCache.set(color, c);
    return c;
  }

  // 慢速气泡弹也预渲染，避免母舰一次释放上百颗气泡时逐弹描边/发光造成卡顿。
  const bubbleSpriteCache = new Map();
  function bubbleSprite(color) {
    if (bubbleSpriteCache.has(color)) return bubbleSpriteCache.get(color);
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.translate(48, 48);
    g.shadowColor = color;
    g.shadowBlur = 10;
    g.strokeStyle = hexToRgba(color, 0.92);
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 34, 0, TAU);
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = hexToRgba(color, 0.17);
    g.fill();
    g.fillStyle = hexToRgba(color, 0.92);
    g.beginPath();
    g.arc(0, 0, 13, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.beginPath();
    g.arc(-5, -6, 6, 0, TAU);
    g.fill();
    bubbleSpriteCache.set(color, c);
    return c;
  }

  const orbSpriteCache = new Map();
  function orbSprite(color) {
    if (orbSpriteCache.has(color)) return orbSpriteCache.get(color);
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(48, 48, 0, 48, 48, 46);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.22, color);
    grad.addColorStop(0.55, hexToRgba(color, 0.32));
    grad.addColorStop(1, hexToRgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 96, 96);
    g.fillStyle = color;
    g.beginPath();
    g.arc(48, 48, 19, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.96)';
    g.beginPath();
    g.arc(44, 43, 7, 0, TAU);
    g.fill();
    orbSpriteCache.set(color, c);
    return c;
  }

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }

  function drawGlow(x, y, radius, color, alpha = 1) {
    const sprite = glowSprite(color);
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (game.shake > 0.2 && game.scene !== 'title' && !game.paused) {
      const s = game.shake;
      ctx.translate(rand(-s, s), rand(-s, s));
    }
    drawStars();
    if (game.scene !== 'title') {
      drawPortal();
      drawPickups();
      drawEnemies();
      drawBoss();
      drawPlayerBullets();
      drawEnemyBullets();
      drawPlayer();
      drawParticles();
      drawFloats();
      drawRings();
      drawPointer();
    }
    ctx.restore();

    if (game.flash > 0) {
      ctx.fillStyle = `rgba(225, 240, 255, ${clamp(game.flash * 0.55, 0, 0.65)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (game.slowT > 0 && game.scene === 'playing') {
      ctx.strokeStyle = 'rgba(103, 232, 249, .18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, W - 2, H - 2);
    }
  }

  function drawPointer() {
    if (!game.pointer.active || !game.player || game.player.dead) return;
    const p = game.player;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.tx, p.ty, 14 * S, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.tx - 22 * S, p.ty);
    ctx.lineTo(p.tx - 17 * S, p.ty);
    ctx.moveTo(p.tx + 17 * S, p.ty);
    ctx.lineTo(p.tx + 22 * S, p.ty);
    ctx.moveTo(p.tx, p.ty - 22 * S);
    ctx.lineTo(p.tx, p.ty - 17 * S);
    ctx.moveTo(p.tx, p.ty + 17 * S);
    ctx.lineTo(p.tx, p.ty + 22 * S);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    const p = game.player;
    if (!p || p.dead) return;
    const def = p.shipDef || SHIPS.dushi;
    const nowMs = performance.now();
    const flicker = p.inv > 0 ? (Math.floor(nowMs / 75) % 2 ? 0.18 : 1) : 1;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt);
    ctx.globalAlpha = flicker;

    // engine flames
    const flame = 12 + Math.sin(nowMs * 0.04) * 3;
    const engineCount = (p.shipKey === 'changcheng' || p.shipKey === 'tianwen') ? 2 : 1;
    const flameWidth = p.shipKey === 'xinghuo' ? 3.1 : 4.4;
    for (let i = 0; i < engineCount; i++) {
      const ex = engineCount === 2 ? (i === 0 ? -6 : 6) * S : 0;
      const fg = ctx.createLinearGradient(ex, 10 * S, ex, (14 + flame) * S);
      fg.addColorStop(0, 'rgba(255,255,255,.92)');
      fg.addColorStop(0.35, hexToRgba(def.accent, 0.88));
      fg.addColorStop(1, hexToRgba(def.color || def.body, 0));
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(ex - flameWidth * S, 10 * S);
      ctx.quadraticCurveTo(ex, (14 + flame) * S, ex + flameWidth * S, 10 * S);
      ctx.closePath();
      ctx.fill();
    }

    // shield
    if (p.shield > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < p.shield; i++) {
        const a = nowMs * 0.001 + i * 2.1;
        ctx.strokeStyle = `rgba(103,232,249,${0.30 + i * 0.08})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(0, 0, (27 + i * 4.5) * S, a, a + 1.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, (27 + i * 4.5) * S, a + Math.PI, a + Math.PI + 0.8);
        ctx.stroke();
      }
      ctx.restore();
    }

    // main hull
    ctx.shadowColor = hexToRgba(def.stroke, 0.65);
    ctx.shadowBlur = 15 * S;
    ctx.fillStyle = def.body;
    ctx.strokeStyle = def.stroke;
    ctx.lineWidth = 1.25 * S;
    ctx.beginPath();
    if (p.shipKey === 'xinghuo') {
      ctx.moveTo(0, -24 * S);
      ctx.lineTo(3.2 * S, -9 * S);
      ctx.lineTo(9 * S, -1 * S);
      ctx.lineTo(22 * S, 5 * S);
      ctx.lineTo(12 * S, 9 * S);
      ctx.lineTo(3.6 * S, 7 * S);
      ctx.lineTo(2.6 * S, 14 * S);
      ctx.lineTo(0, 11 * S);
      ctx.lineTo(-2.6 * S, 14 * S);
      ctx.lineTo(-3.6 * S, 7 * S);
      ctx.lineTo(-12 * S, 9 * S);
      ctx.lineTo(-22 * S, 5 * S);
      ctx.lineTo(-9 * S, -1 * S);
      ctx.lineTo(-3.2 * S, -9 * S);
    } else if (p.shipKey === 'changcheng') {
      ctx.moveTo(0, -21 * S);
      ctx.lineTo(6 * S, -14 * S);
      ctx.lineTo(12 * S, -10 * S);
      ctx.lineTo(23 * S, -5 * S);
      ctx.lineTo(23 * S, 7 * S);
      ctx.lineTo(14 * S, 11 * S);
      ctx.lineTo(8 * S, 8 * S);
      ctx.lineTo(5 * S, 15 * S);
      ctx.lineTo(0, 11 * S);
      ctx.lineTo(-5 * S, 15 * S);
      ctx.lineTo(-8 * S, 8 * S);
      ctx.lineTo(-14 * S, 11 * S);
      ctx.lineTo(-23 * S, 7 * S);
      ctx.lineTo(-23 * S, -5 * S);
      ctx.lineTo(-12 * S, -10 * S);
      ctx.lineTo(-6 * S, -14 * S);
    } else if (p.shipKey === 'tianwen') {
      ctx.moveTo(0, -22 * S);
      ctx.lineTo(5 * S, -10 * S);
      ctx.lineTo(15 * S, -6 * S);
      ctx.lineTo(19 * S, 2 * S);
      ctx.lineTo(13 * S, 10 * S);
      ctx.lineTo(6 * S, 9 * S);
      ctx.lineTo(4 * S, 15 * S);
      ctx.lineTo(0, 11 * S);
      ctx.lineTo(-4 * S, 15 * S);
      ctx.lineTo(-6 * S, 9 * S);
      ctx.lineTo(-13 * S, 10 * S);
      ctx.lineTo(-19 * S, 2 * S);
      ctx.lineTo(-15 * S, -6 * S);
      ctx.lineTo(-5 * S, -10 * S);
    } else {
      ctx.moveTo(0, -22 * S);
      ctx.lineTo(4.8 * S, -8 * S);
      ctx.lineTo(17 * S, 2 * S);
      ctx.lineTo(12 * S, 7 * S);
      ctx.lineTo(4.5 * S, 4 * S);
      ctx.lineTo(3 * S, 13 * S);
      ctx.lineTo(0, 10 * S);
      ctx.lineTo(-3 * S, 13 * S);
      ctx.lineTo(-4.5 * S, 4 * S);
      ctx.lineTo(-12 * S, 7 * S);
      ctx.lineTo(-17 * S, 2 * S);
      ctx.lineTo(-4.8 * S, -8 * S);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // wing / armor accents
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hexToRgba(def.secondary, 0.82);
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (p.shipKey === 'changcheng') {
      ctx.moveTo(-17 * S, -2 * S);
      ctx.lineTo(17 * S, -2 * S);
      ctx.moveTo(-11 * S, 5 * S);
      ctx.lineTo(11 * S, 5 * S);
    } else if (p.shipKey === 'tianwen') {
      ctx.arc(0, -1 * S, 9 * S, 0, TAU);
    } else {
      ctx.moveTo(-12 * S, 3.4 * S);
      ctx.lineTo(-4.6 * S, -3.5 * S);
      ctx.moveTo(12 * S, 3.4 * S);
      ctx.lineTo(4.6 * S, -3.5 * S);
    }
    ctx.stroke();

    // central stripe or sensor core
    if (p.shipKey === 'tianwen') {
      ctx.fillStyle = hexToRgba(def.accent, 0.55);
      ctx.beginPath();
      ctx.arc(0, -1 * S, 3.2 * S, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = hexToRgba(def.secondary, 0.72);
      ctx.beginPath();
      ctx.moveTo(0, -17 * S);
      ctx.lineTo(2.4 * S, -4 * S);
      ctx.lineTo(0, 7 * S);
      ctx.lineTo(-2.4 * S, -4 * S);
      ctx.closePath();
      ctx.fill();
    }

    // cockpit
    ctx.shadowColor = def.accent;
    ctx.shadowBlur = 11 * S;
    ctx.fillStyle = def.bullet;
    ctx.beginPath();
    if (p.shipKey === 'tianwen') {
      ctx.arc(0, -5 * S, 2.4 * S, 0, TAU);
    } else {
      const cw = p.shipKey === 'changcheng' ? 3.1 : p.shipKey === 'xinghuo' ? 2.1 : 2.6;
      const ch = p.shipKey === 'changcheng' ? 5.7 : p.shipKey === 'xinghuo' ? 5 : 5.4;
      ctx.ellipse(0, -5 * S, cw * S, ch * S, 0, 0, TAU);
    }
    ctx.fill();

    // hitbox core
    ctx.shadowBlur = 0;
    ctx.globalAlpha = flicker * 0.92;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.2 * S, p.r * 0.62), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(def.accent, 0.42);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + 2.2 * S, 0, TAU);
    ctx.stroke();

    // wingmen
    const wingmen = wingmanSlots(wingmanCount(p.fireLvl));
    ctx.globalAlpha = flicker;
    for (const slot of wingmen) {
      ctx.save();
      ctx.translate(slot.x, slot.y);
      ctx.rotate(slot.angle * 0.35);
      ctx.fillStyle = '#0b2130';
      ctx.strokeStyle = def.accent;
      ctx.lineWidth = 1;
      ctx.shadowColor = def.accent;
      ctx.shadowBlur = 8 * S;
      ctx.beginPath();
      ctx.moveTo(0, -5 * S);
      ctx.lineTo(3.6 * S, 0);
      ctx.lineTo(0, 5 * S);
      ctx.lineTo(-3.6 * S, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = def.secondary;
      ctx.beginPath();
      ctx.arc(0, 0, 1.3 * S, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawEnemies() {
    for (const e of game.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === 'drone') {
        ctx.rotate(Math.sin(e.t * 2.2 + e.phase) * 0.18);
        ctx.shadowColor = '#fb7185';
        ctx.shadowBlur = 12 * S;
        ctx.fillStyle = e.hitT > 0 ? '#fff' : '#2a1029';
        ctx.strokeStyle = '#fb7185';
        ctx.lineWidth = 1.2 * S;
        ctx.beginPath();
        ctx.moveTo(0, 13 * S);
        ctx.lineTo(-11 * S, -7 * S);
        ctx.lineTo(-4 * S, -11 * S);
        ctx.lineTo(0, -6 * S);
        ctx.lineTo(4 * S, -11 * S);
        ctx.lineTo(11 * S, -7 * S);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffd1dc';
        ctx.beginPath();
        ctx.arc(0, 1 * S, 2.1 * S, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'weaver') {
        ctx.rotate(Math.sin(e.t * 1.7) * 0.3);
        ctx.shadowColor = '#f472b6';
        ctx.shadowBlur = 14 * S;
        ctx.fillStyle = e.hitT > 0 ? '#fff' : '#24102e';
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 1.2 * S;
        ctx.beginPath();
        ctx.moveTo(0, -15 * S);
        ctx.lineTo(8 * S, 0);
        ctx.lineTo(0, 15 * S);
        ctx.lineTo(-8 * S, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.rotate(-Math.sin(e.t * 1.7) * 0.6);
        ctx.strokeStyle = 'rgba(196,181,253,.6)';
        ctx.beginPath();
        ctx.moveTo(-18 * S, 0);
        ctx.lineTo(-7 * S, 0);
        ctx.moveTo(18 * S, 0);
        ctx.lineTo(7 * S, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fdf2f8';
        ctx.beginPath();
        ctx.arc(0, 0, 2.4 * S, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'turret') {
        ctx.rotate(e.spin);
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur = 15 * S;
        ctx.fillStyle = e.hitT > 0 ? '#fff' : '#2b1620';
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 1.2 * S;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (TAU * i) / 8;
          const r = i % 2 === 0 ? 18 * S : 13 * S;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(245,201,107,.8)';
        for (let i = 0; i < 4; i++) {
          const a = (TAU * i) / 4;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 6 * S, Math.sin(a) * 6 * S);
          ctx.lineTo(Math.cos(a) * 13 * S, Math.sin(a) * 13 * S);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffe8c2';
        ctx.beginPath();
        ctx.arc(0, 0, 3.2 * S, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'lancer') {
        ctx.rotate(Math.atan2(e.vy, e.vx) + Math.PI / 2);
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 14 * S;
        ctx.fillStyle = e.hitT > 0 ? '#fff' : '#2b1c0e';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.2 * S;
        ctx.beginPath();
        ctx.moveTo(0, -15 * S);
        ctx.lineTo(5 * S, -4 * S);
        ctx.lineTo(11 * S, 6 * S);
        ctx.lineTo(4 * S, 5 * S);
        ctx.lineTo(0, 12 * S);
        ctx.lineTo(-4 * S, 5 * S);
        ctx.lineTo(-11 * S, 6 * S);
        ctx.lineTo(-5 * S, -4 * S);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,237,190,.78)';
        ctx.beginPath();
        ctx.moveTo(0, -11 * S);
        ctx.lineTo(0, 6 * S);
        ctx.stroke();
      } else if (e.kind === 'sentinel') {
        ctx.rotate(e.spin);
        ctx.shadowColor = '#c4b5fd';
        ctx.shadowBlur = 16 * S;
        ctx.fillStyle = e.hitT > 0 ? '#fff' : '#1b1430';
        ctx.strokeStyle = '#c4b5fd';
        ctx.lineWidth = 1.2 * S;
        ctx.beginPath();
        ctx.moveTo(0, -18 * S);
        ctx.lineTo(13 * S, -5 * S);
        ctx.lineTo(11 * S, 12 * S);
        ctx.lineTo(0, 18 * S);
        ctx.lineTo(-11 * S, 12 * S);
        ctx.lineTo(-13 * S, -5 * S);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(103,232,249,.75)';
        ctx.beginPath();
        ctx.arc(0, 0, 8 * S, 0, TAU);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#e8ffff';
        ctx.beginPath();
        ctx.arc(0, 0, 2.8 * S, 0, TAU);
        ctx.fill();
      } else if (e.kind === 'carrier') {
        if (e.escortRings && e.escortRings.length) {
          ctx.strokeStyle = 'rgba(103,232,249,.18)';
          ctx.lineWidth = 1 * S;
          ctx.setLineDash([4 * S, 7 * S]);
          for (const ring of e.escortRings) {
            ctx.beginPath();
            ctx.arc(0, 0, ring.radius, 0, TAU);
            ctx.stroke();
          }
          ctx.setLineDash([]);
        }
        ctx.rotate(Math.sin(e.t * 0.6) * 0.06);
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 20 * S;
        ctx.fillStyle = e.hitT > 0 ? '#fff' : '#10232c';
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 1.4 * S;
        ctx.beginPath();
        ctx.moveTo(0, -27 * S);
        ctx.lineTo(18 * S, -17 * S);
        ctx.lineTo(28 * S, 5 * S);
        ctx.lineTo(13 * S, 23 * S);
        ctx.lineTo(0, 18 * S);
        ctx.lineTo(-13 * S, 23 * S);
        ctx.lineTo(-28 * S, 5 * S);
        ctx.lineTo(-18 * S, -17 * S);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(165,243,252,.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-17 * S, -8 * S);
        ctx.lineTo(17 * S, -8 * S);
        ctx.moveTo(-20 * S, 3 * S);
        ctx.lineTo(20 * S, 3 * S);
        ctx.stroke();
        ctx.fillStyle = '#d9ffff';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(i * 8 * S, 10 * S, 1.8 * S, 0, TAU);
          ctx.fill();
        }
        const ratio = clamp(e.hp / e.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fillRect(-26 * S, 31 * S, 52 * S, 3 * S);
        ctx.fillStyle = '#67e8f9';
        ctx.fillRect(-26 * S, 31 * S, 52 * S * ratio, 3 * S);
      } else if (e.kind === 'wingman') {
        if (e.leader && !e.leader.dead) {
          ctx.strokeStyle = 'rgba(103,232,249,.22)';
          ctx.lineWidth = 0.8 * S;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(e.leader.x - e.x, e.leader.y - e.y);
          ctx.stroke();
        }
        ctx.rotate(e.t * 1.8);
        ctx.shadowColor = '#67e8f9';
        ctx.shadowBlur = 10 * S;
        ctx.fillStyle = e.hitT > 0 ? '#fff' : '#10232c';
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 1 * S;
        ctx.beginPath();
        ctx.moveTo(0, 8 * S);
        ctx.lineTo(6 * S, 0);
        ctx.lineTo(0, -8 * S);
        ctx.lineTo(-6 * S, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#d9ffff';
        ctx.beginPath();
        ctx.arc(0, 0, 2 * S, 0, TAU);
        ctx.fill();
      } else {
        // elite
        ctx.rotate(Math.sin(e.t * 0.8) * 0.08);
        ctx.shadowColor = '#f5c96b';
        ctx.shadowBlur = 22 * S;
        ctx.fillStyle = e.hitT > 0 ? '#fff' : '#28122c';
        ctx.strokeStyle = '#f5c96b';
        ctx.lineWidth = 1.5 * S;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (TAU * i) / 6 + Math.PI / 6;
          const r = i % 2 === 0 ? 29 * S : 23 * S;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(251,113,133,.8)';
        ctx.beginPath();
        ctx.arc(0, 0, 17 * S, 0, TAU);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff1cc';
        ctx.beginPath();
        ctx.arc(0, 0, 4.8 * S, 0, TAU);
        ctx.fill();
        // hp bar
        const ratio = clamp(e.hp / e.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fillRect(-24 * S, 36 * S, 48 * S, 3 * S);
        ctx.fillStyle = '#f5c96b';
        ctx.fillRect(-24 * S, 36 * S, 48 * S * ratio, 3 * S);
      }
      ctx.restore();
    }
  }


  function drawMidboss(b) {
    const deadAlpha = b.dead ? clamp(1 - b.deadT / 2.2, 0, 1) : 1;
    if (deadAlpha <= 0) return;
    const pulse = 1 + Math.sin(b.t * 4.2) * 0.03;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.globalAlpha = deadAlpha;
    ctx.scale(pulse, pulse);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(0, 0, 8 * S, 0, 0, 92 * S);
    aura.addColorStop(0, 'rgba(196,181,253,.26)');
    aura.addColorStop(0.5, 'rgba(103,232,249,.10)');
    aura.addColorStop(1, 'rgba(196,181,253,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 92 * S, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 观察者的环形眼与四片翼。
    ctx.save();
    ctx.rotate(b.t * 0.45);
    ctx.strokeStyle = 'rgba(103,232,249,.55)';
    ctx.lineWidth = 1.3 * S;
    for (let i = 0; i < 4; i++) {
      const a = (TAU * i) / 4;
      ctx.beginPath();
      ctx.arc(0, 0, (28 + i * 4) * S, a, a + 1.5);
      ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < 4; i++) {
      const a = (TAU * i) / 4 + Math.PI / 4;
      ctx.save();
      ctx.rotate(a);
      ctx.strokeStyle = i % 2 ? 'rgba(245,201,107,.7)' : 'rgba(196,181,253,.7)';
      ctx.lineWidth = 1.2 * S;
      ctx.beginPath();
      ctx.moveTo(10 * S, 0);
      ctx.quadraticCurveTo(38 * S, -13 * S, 54 * S, 0);
      ctx.quadraticCurveTo(38 * S, 13 * S, 10 * S, 0);
      ctx.stroke();
      ctx.restore();
    }

    ctx.shadowColor = '#c4b5fd';
    ctx.shadowBlur = 18 * S;
    ctx.fillStyle = b.hitT > 0 ? '#fff' : '#170d2e';
    ctx.strokeStyle = '#c4b5fd';
    ctx.lineWidth = 1.6 * S;
    ctx.beginPath();
    ctx.moveTo(0, -27 * S);
    ctx.lineTo(24 * S, 0);
    ctx.lineTo(0, 27 * S);
    ctx.lineTo(-24 * S, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f5c96b';
    ctx.beginPath();
    ctx.arc(0, 0, 6.5 * S, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.arc(0, 0, 2.8 * S, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBoss() {
    const b = game.boss;
    if (!b) return;
    if (b.isMidboss) { drawMidboss(b); return; }
    const color = PHASE_COLORS[b.phase];
    const deadAlpha = b.dead ? clamp(1 - b.deadT / 2.4, 0, 1) : 1;
    if (deadAlpha <= 0) return;
    const rot = b.t * 0.6;
    const pulse = 1 + Math.sin(b.t * 4) * 0.025;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.globalAlpha = deadAlpha;
    ctx.scale(pulse, pulse);

    // outer aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(0, 0, 10 * S, 0, 0, 115 * S);
    aura.addColorStop(0, hexToRgba(color, 0.24));
    aura.addColorStop(0.5, hexToRgba(color, 0.08));
    aura.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 115 * S, 0, TAU);
    ctx.fill();
    ctx.restore();

    // broken structural spurs
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const a = rot * 0.3 + (TAU * i) / 8;
      ctx.strokeStyle = i % 2 ? hexToRgba(color, 0.28) : 'rgba(196,181,253,.18)';
      ctx.lineWidth = 1.3 * S;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 66 * S, Math.sin(a) * 66 * S);
      ctx.lineTo(Math.cos(a) * (92 + (i % 3) * 6) * S, Math.sin(a) * (92 + (i % 3) * 6) * S);
      ctx.stroke();
    }
    ctx.restore();

    // three orbital rings
    for (let ring = 0; ring < 3; ring++) {
      const rr = (75 - ring * 14) * S;
      ctx.save();
      ctx.rotate(rot * (ring % 2 ? -1 : 1) * (0.7 + ring * 0.18));
      ctx.strokeStyle = hexToRgba(color, 0.52 - ring * 0.08);
      ctx.lineWidth = (2.1 - ring * 0.35) * S;
      ctx.beginPath();
      for (let seg = 0; seg < 3; seg++) {
        const start = (TAU * seg) / 3 + 0.18;
        ctx.arc(0, 0, rr, start, start + 1.2);
        ctx.stroke();
        ctx.beginPath();
      }
      // gear teeth for phase 3
      if (b.phase === 2) {
        ctx.strokeStyle = hexToRgba(color, 0.35);
        ctx.lineWidth = 1 * S;
        for (let k = 0; k < 18; k++) {
          const a = (TAU * k) / 18;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (rr - 2 * S), Math.sin(a) * (rr - 2 * S));
          ctx.lineTo(Math.cos(a) * (rr + 5 * S), Math.sin(a) * (rr + 5 * S));
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // core body
    ctx.shadowColor = color;
    ctx.shadowBlur = 28 * S;
    const bodyGrad = ctx.createRadialGradient(-12 * S, -15 * S, 3 * S, 0, 0, 51 * S);
    bodyGrad.addColorStop(0, '#f8f1ff');
    bodyGrad.addColorStop(0.15, color);
    bodyGrad.addColorStop(0.46, '#2c1540');
    bodyGrad.addColorStop(1, '#090512');
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = b.hitT > 0 ? '#fff' : color;
    ctx.lineWidth = 1.5 * S;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot * 0.25 + (TAU * i) / 10;
      const rr = i % 2 === 0 ? 52 * S : 39 * S;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // inner eye
    ctx.shadowBlur = 20 * S;
    ctx.fillStyle = '#08040f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 25 * S, 16 * S, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(color, 0.8);
    ctx.lineWidth = 1.2 * S;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6 * S, 13 * S, Math.sin(b.t * 0.8) * 0.18, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-1 * S, -2 * S, 2 * S, 0, TAU);
    ctx.fill();

    // data fragments
    ctx.shadowBlur = 0;
    ctx.fillStyle = hexToRgba(color, 0.5);
    for (let i = 0; i < 6; i++) {
      const a = b.t * (0.4 + i * 0.07) + i * 1.2;
      const rr = (60 + (i % 2) * 15) * S;
      ctx.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, 2 * S, 2 * S);
    }

    // 一阶段吸收进度：Boss 身上逐渐变大的大星弹。
    if (b.phase === 0 && b.absorbTarget) {
      const progress = clamp(b.absorbCharge / b.absorbTarget, 0, 1);
      if (progress > 0.01) {
        const size = (8 + 28 * progress) * S;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 + progress * 0.35;
        ctx.rotate(b.t * 1.6);
        ctx.drawImage(starSprite('#f5c96b'), -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  function drawPlayerBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of game.pBullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI / 2);
      drawGlow(0, 0, b.r * 2.8, b.color, 0.62);
      ctx.strokeStyle = hexToRgba(b.color, 0.55);
      ctx.lineWidth = b.r * 0.9;
      ctx.beginPath();
      ctx.moveTo(0, 8 * S);
      ctx.lineTo(0, -b.r * 1.2);
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 0.72, b.r * 1.9, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(0, 0, b.r * 0.3, b.r * 1.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawEnemyBullets() {
    for (const b of game.eBullets) {
      // 光玉与气泡不需要逐弹 save/translate/rotate，直接按屏幕坐标绘制。
      if (b.type === 'orb') {
        const size = b.r * 5.4;
        ctx.drawImage(orbSprite(b.color), b.x - size / 2, b.y - size / 2, size, size);
        continue;
      }
      if (b.type === 'bubble') {
        const size = b.r * 2.82;
        ctx.drawImage(bubbleSprite(b.color), b.x - size / 2, b.y - size / 2, size, size);
        continue;
      }
      if (b.type === 'star' && !b.mainStar && !b.bigStar) {
        // 普通星弹近似旋转对称，省掉逐弹变换；主星 / 大星仍保留自转。
        const size = b.r * 5.7;
        ctx.drawImage(starSprite(b.color), b.x - size / 2, b.y - size / 2, size, size);
        continue;
      }
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.type === 'square') {
        ctx.rotate(b.angle + Math.PI / 4);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10 * S;
        ctx.fillStyle = hexToRgba(b.color, 0.92);
        ctx.fillRect(-b.r, -b.r, b.r * 2, b.r * 2);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        ctx.fillRect(-b.r * 0.38, -b.r * 0.38, b.r * 0.76, b.r * 0.76);
      } else if (b.type === 'shard') {
        ctx.rotate(b.angle);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 12 * S;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(b.r * 2.5, 0);
        ctx.lineTo(-b.r * 1.3, b.r * 0.9);
        ctx.lineTo(-b.r * 0.6, 0);
        ctx.lineTo(-b.r * 1.3, -b.r * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.88)';
        ctx.beginPath();
        ctx.arc(b.r * 0.4, 0, b.r * 0.5, 0, TAU);
        ctx.fill();
      } else if (b.type === 'rice') {
        ctx.rotate(b.angle);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 9 * S;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.r * 1.9, b.r * 0.8, 0, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,.96)';
        ctx.beginPath();
        ctx.ellipse(b.r * 0.32, 0, b.r * 0.92, b.r * 0.34, 0, 0, TAU);
        ctx.fill();
      } else if (b.type === 'star') {
        ctx.rotate(b.angle);
        const size = b.r * 5.7;
        ctx.drawImage(starSprite(b.color), -size / 2, -size / 2, size, size);
      } else {
        const size = b.r * 5.4;
        ctx.drawImage(orbSprite(b.color), -size / 2, -size / 2, size, size);
      }
      ctx.restore();
    }
  }

  function drawPickups() {
    for (const u of game.drops) {
      const info = DISCIPLINES[u.type];
      const bob = Math.sin(u.t * 2.2) * 3 * S;
      ctx.save();
      ctx.translate(u.x, u.y + bob);
      ctx.rotate(Math.sin(u.t) * 0.08);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(0, 0, 29 * S, info.color, 0.6);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = hexToRgba(info.color, 0.9);
      ctx.lineWidth = 1.2 * S;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (TAU * i) / 6 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * 14 * S, Math.sin(a) * 14 * S);
        else ctx.lineTo(Math.cos(a) * 14 * S, Math.sin(a) * 14 * S);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(8,5,18,.82)';
      ctx.fill();
      ctx.shadowColor = info.color;
      ctx.shadowBlur = 14 * S;
      ctx.strokeStyle = info.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9.2 * S, u.t * 1.4, u.t * 1.4 + 4.2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = info.color;
      if (u.type === 'aero') {
        ctx.beginPath();
        ctx.moveTo(0, -6.5 * S);
        ctx.lineTo(4.2 * S, 4.5 * S);
        ctx.lineTo(0, 2.2 * S);
        ctx.lineTo(-4.2 * S, 4.5 * S);
        ctx.closePath();
        ctx.fill();
      } else if (u.type === 'code') {
        ctx.font = `700 ${10 * S}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('</>', 0, 0.5 * S);
      } else {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (TAU * i) / 8;
          const r = i % 2 === 0 ? 6.4 * S : 4 * S;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#0b0718';
        ctx.beginPath();
        ctx.arc(0, 0, 2 * S, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawPortal() {
    const p = game.portal;
    if (!p) return;
    const t = p.t;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(0, 0, 4 * S, 0, 0, 90 * S);
    halo.addColorStop(0, 'rgba(255,255,255,.7)');
    halo.addColorStop(0.25, 'rgba(103,232,249,.32)');
    halo.addColorStop(0.55, 'rgba(167,139,250,.14)');
    halo.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 90 * S, 0, TAU);
    ctx.fill();

    for (let i = 0; i < 4; i++) {
      const rr = (p.r - i * 7 * S) * (1 + Math.sin(t * 2 + i) * 0.03);
      const start = t * (1.1 + i * 0.3) + i * 1.7;
      ctx.strokeStyle = i % 2 ? 'rgba(103,232,249,.72)' : 'rgba(196,181,253,.7)';
      ctx.lineWidth = (2.5 - i * 0.4) * S;
      ctx.beginPath();
      ctx.arc(0, 0, rr, start, start + 2.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, rr, start + Math.PI, start + Math.PI + 1.4);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5,3,15,.88)';
    ctx.beginPath();
    ctx.arc(0, 0, p.r * 0.58, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e9e3ff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // inward particles
    for (let i = 0; i < 8; i++) {
      const a = t * 0.8 + i * 0.8;
      const rr = p.r * (0.9 + ((t * 0.28 + i * 0.13) % 1) * 1.7);
      ctx.fillStyle = i % 2 ? '#67e8f9' : '#c4b5fd';
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 1.2 * S, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = `600 ${10 * S}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(245,242,255,.78)';
    ctx.fillText('跃 迁 门', 0, p.r + 22 * S);
    ctx.restore();

    // guiding chevrons
    const p2 = game.player;
    if (p2 && !p2.dead) {
      const far = p2.y > p.y + p.r + 80 * S;
      if (far) {
        const alpha = 0.28 + Math.sin(t * 4) * 0.16;
        ctx.save();
        ctx.strokeStyle = `rgba(103,232,249,${alpha})`;
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) {
          const yy = H - (130 + i * 26) * S + Math.sin(t * 3 + i) * 4 * S;
          ctx.beginPath();
          ctx.moveTo(W / 2 - 12 * S, yy + 8 * S);
          ctx.lineTo(W / 2, yy);
          ctx.lineTo(W / 2 + 12 * S, yy + 8 * S);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  function drawParticles() {
    ctx.save();
    for (const p of game.particles) {
      const alpha = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = alpha;
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.restore();
  }

  function drawFloats() {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of game.floats) {
      const alpha = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = `500 ${f.size}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  function drawRings() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of game.rings) {
      const alpha = clamp(r.life / r.max, 0, 1) * 0.8;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- input ---------- */
  function pointerPos(e) {
    const rect = frame.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (game.scene !== 'playing' || game.paused || !game.player || game.player.dead) return;
    if (e.target.closest && e.target.closest('button')) return;
    const pos = pointerPos(e);
    game.pointer.active = true;
    game.pointer.id = e.pointerId;
    game.pointer.sx = pos.x;
    game.pointer.sy = pos.y;
    game.pointer.px = game.player.tx;
    game.pointer.py = game.player.ty;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!game.pointer.active || game.pointer.id !== e.pointerId || game.paused || !game.player) return;
    const pos = pointerPos(e);
    const dx = pos.x - game.pointer.sx;
    const dy = pos.y - game.pointer.sy;
    game.player.tx = game.pointer.px + dx * 1.08;
    game.player.ty = game.pointer.py + dy * 1.08;
    e.preventDefault();
  }

  function releasePointer(e) {
    if (game.pointer.id !== null && e.pointerId !== undefined && game.pointer.id !== e.pointerId) return;
    game.pointer.active = false;
    game.pointer.id = null;
  }

  function onKeyDown(e) {
    const code = e.code;
    if (code === 'Space') e.preventDefault();
    if (!el.screenShip.hidden) {
      if (code === 'Escape') {
        e.preventDefault();
        closeShipSelect();
      }
      return;
    }
    if (game.scene === 'title') {
      if (code === 'Enter') {
        e.preventDefault();
        startGame();
      }
      return;
    }
    if (game.scene === 'result') {
      if (code === 'Enter') {
        e.preventDefault();
        startGame();
      }
      if (code === 'Escape') goHome();
      return;
    }
    if (game.scene !== 'playing') return;

    if (code === 'Escape' || code === 'KeyP') {
      e.preventDefault();
      if (game.paused) resumeGame(); else pauseGame();
      return;
    }
    if (code === 'KeyM') {
      setMuted(!audio.muted);
      return;
    }
    if (game.paused) return;
    if (CHEAT_CLEAR_ENABLED && code === 'KeyQ') {
      e.preventDefault();
      clearEnemyBullets(true);
      for (const en of game.enemies) {
        spawnBurst(en.x, en.y, '#67e8f9', 3, 60, 1.2);
      }
      game.enemies = [];
      game.gearFormation = null;
      showHint('测试清场：弹幕与小怪已清除', 1000);
      updateHud(true);
      return;
    }
    if (code === 'Space') {
      useBomb();
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) {
      game.keys.add(code);
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    game.keys.delete(e.code);
  }

  /* ---------- wire ---------- */
  el.modeSwitch.addEventListener('click', e => {
    const btn = e.target.closest('.mode-option');
    if (!btn) return;
    setMode(btn.dataset.mode);
    audio.init();
    audio.tone(392, 0.07, 'sine', 0.018, 523);
  });

  el.shipChip.addEventListener('click', () => {
    audio.init();
    openShipSelect();
    audio.tone(660, 0.06, 'sine', 0.018, 880);
  });
  el.shipGrid.addEventListener('click', e => {
    const btn = e.target.closest('.ship-option');
    if (!btn) return;
    setShip(btn.dataset.ship);
    audio.tone(520, 0.06, 'sine', 0.02, 740);
  });
  el.btnShipConfirm.addEventListener('click', closeShipSelect);
  el.btnShipClose.addEventListener('click', closeShipSelect);

  el.diffGrid.addEventListener('click', e => {
    const btn = e.target.closest('.difficulty-option');
    if (!btn) return;
    setDifficulty(btn.dataset.difficulty);
    audio.init();
    audio.tone(520, 0.06, 'sine', 0.02, 680);
  });

  el.launch.addEventListener('click', () => {
    audio.init();
    startGame();
  });

  el.pauseBtn.addEventListener('click', pauseGame);
  $('btn-resume').addEventListener('click', resumeGame);
  $('btn-restart-pause').addEventListener('click', () => {
    el.pause.hidden = true;
    game.paused = false;
    audio.suspendForPause(false);
    startGame();
  });
  $('btn-home-pause').addEventListener('click', goHome);
  $('btn-again').addEventListener('click', startGame);
  $('btn-home').addEventListener('click', goHome);
  el.bomb.addEventListener('click', useBomb);
  el.sound.addEventListener('click', () => {
    audio.init();
    setMuted(!audio.muted);
  });

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', resize);
  window.addEventListener('blur', () => { game.keys.clear(); game.pointer.active = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.scene === 'playing' && !game.paused && game.phase !== 'ending') pauseGame();
    if (!document.hidden) audio.unlockBgm();
  });

  // Browsers require a gesture before audible playback; start the title theme on
  // the first tap/keypress, then crossfade to the combat theme on launch.
  // 每次手势都调用 unlockBgm()，以便自动播放被拒绝后能在本地环境重试。
  document.addEventListener('pointerdown', () => {
    if (game.scene === 'title') startMenuBgm();
    audio.unlockBgm();
  }, { passive: true });
  window.addEventListener('keydown', () => {
    if (game.scene === 'title') startMenuBgm();
    audio.unlockBgm();
  });

  /* ---------- boot / debug ---------- */
  function installDebugApi() {
    if (!new URLSearchParams(location.search).has('debug')) return;
    window.__DUSHI_DEBUG__ = {
      start: () => { if (game.scene !== 'playing') startGame(); },
      setMode: key => { if (game.scene === 'title') setMode(key); },
      setShip: key => { setShip(key); },
      setDifficulty: key => { setDifficulty(key); },
      setTime: seconds => { game.time = Number(seconds) || 0; },
      step: seconds => {
        const total = Math.min(300, Number(seconds) || 0);
        for (let t = 0; t < total; t += 1 / 60) update(1 / 60);
        return game.time;
      },
      setCycle: n => {
        game.cycle = Math.max(1, Math.floor(Number(n) || 1));
        game.enemyScale = 1 + (game.cycle - 1) * 0.12;
        game.enemyBulletScale = 1 + Math.min(0.2, (game.cycle - 1) * 0.02);
        updateHud(true);
        return game.cycle;
      },
      trackBoss: on => { game.debugAutoTrack = !!on; },
      spawnEnemy: (kind = 'drone', x = W / 2) => spawnEnemy(kind, x, -30 * S),
      spawnPickup: (type = null) => spawnPickup(type),
      give: type => { if (game.player) spawnPickup(type, game.player.x, game.player.y); },
      god: on => { game.debugGod = !!on; },
      heal: n => { if (game.player) { game.player.hp = clamp(Number(n) || game.player.maxHp, 1, 99); updateHud(true); } },
      spawnWave: () => spawnWave(),
      bomb: () => { if (game.player) game.player.bomb = 100; useBomb(); },
      toBoss: () => {
        if (game.scene !== 'playing') startGame();
        if (!game.boss) { game.time = 100; game.bossSpawned = false; startBoss(); }
        if (game.boss) { game.boss.entry = 0; game.boss.invuln = 0; game.boss.y = game.boss.targetY; game.boss.spellT = 1.8; }
      },
      bossPhase: n => {
        if (!game.boss) return;
        const b = game.boss;
        b.entry = 0; b.invuln = 0; b.transition = 0;
        b.hp = b.maxHp * (n === 0 ? 1 : n === 1 ? 0.6 : 0.3);
        b.phase = Math.max(0, Math.min(2, n));
        b.mode = 0; b.modeT = 0; b.fireT = 0.2;
        b.spellT = 0.01;
      },
      damageBoss: n => damageBoss(Number(n) || 100, game.boss ? game.boss.x : W / 2, game.boss ? game.boss.y : 100),
      toPortal: () => {
        if (game.scene !== 'playing') startGame();
        if (!game.boss) { game.time = 100; game.bossSpawned = false; startBoss(); }
        if (game.boss) {
          game.boss.entry = 0;
          game.boss.invuln = 0;
          game.boss.hp = 0;
          defeatBoss();
        }
      },
      openPortal: () => { if (game.scene === 'playing' && !game.portal) openPortal(); },
      win: () => { if (game.scene === 'playing' && game.portal && game.player) { game.player.x = game.portal.x; game.player.y = game.portal.y; game.player.tx = game.player.x; game.player.ty = game.player.y; } },
      lose: () => { if (game.scene === 'playing') endRun(false); },
      state: () => ({
        scene: game.scene,
        phase: game.phase,
        mode: game.mode,
        difficulty: game.difficulty.key,
        tier: game.difficulty.tier,
        ship: game.shipKey,
        cycle: game.cycle,
        nextBossAt: +game.nextBossAt.toFixed(2),
        enemyScale: +game.enemyScale.toFixed(2),
        time: +game.time.toFixed(2),
        score: Math.round(game.score),
        hp: game.player ? game.player.hp : null,
        maxHp: game.player ? game.player.maxHp : null,
        shield: game.player ? game.player.shield : null,
        maxShield: game.player ? game.player.maxShield : null,
        hitR: game.player ? +game.player.r.toFixed(2) : null,
        grazeR: game.player ? +game.player.grazeR.toFixed(2) : null,
        bomb: game.player ? Math.round(game.player.bomb) : null,
        pos: game.player ? [Math.round(game.player.x), Math.round(game.player.y)] : null,
        levels: game.player ? [game.player.fireLvl, game.player.codeLvl, game.player.ieLvl] : null,
        enemies: game.enemies.length,
        enemyKinds: game.enemies.map(e => e.kind),
        highThreatAlive: highThreatCount(),
        waveIndex: game.waveIndex,
        waveBudget: +(game.waveBudget || 0).toFixed(2),
        spawnCounts: { ...game.spawnCounts },
        nextHighThreatAt: +game.nextHighThreatAt.toFixed(2),
        lastHighThreatAt: +game.lastHighThreatAt.toFixed(2),
        enemyHp: game.enemies.slice(0, 3).map(e => Math.round(e.maxHp)),
        pBullets: game.pBullets.length,
        eBullets: game.eBullets.length,
        absorbBullets: game.eBullets.filter(b => b.bossAbsorb).length,
        bigStars: game.eBullets.filter(b => b.bigStar).length,
        mainStars: game.eBullets.filter(b => b.mainStar).map(b => [Math.round(b.x), Math.round(b.y)]),
        drops: game.drops.length,
        boss: game.boss ? { phase: game.boss.phase, hp: Math.round(game.boss.hp), max: Math.round(game.boss.maxHp), entry: +game.boss.entry.toFixed(2), transition: +game.boss.transition.toFixed(2), absorb: +(game.boss.absorbCharge || 0).toFixed(2), absorbTarget: game.boss.absorbTarget || 0 } : null,
        portal: !!game.portal,
        paused: game.paused,
        audio: audio.getAudioState()
      })
    };
  }

  function boot() {
    setDifficulty('normal');
    setMode('campaign');
    buildShipCards();
    const savedShip = safeGet('ship', 'dushi');
    setShip(SHIPS[savedShip] ? savedShip : 'dushi', false);
    setMuted(audio.muted);
    resize();
    // 预生成星弹 / 气泡弹精灵，避免第一次齐射时临时创建 canvas 造成帧尖峰。
    starSprite('#f5c96b');
    starSprite('#c4b5fd');
    bubbleSprite('#67e8f9');
    installDebugApi();
    // Try title music immediately; browsers that block autoplay retry on the
    // first tap/keypress through the one-shot gesture listeners below.
    setTimeout(() => {
      if (game.scene === 'title') startMenuBgm();
    }, 500);
    // preserve the title screen’s first paint even on very short viewports
    el.title.scrollTop = 0;
    requestAnimationFrame(t => {
      lastFrame = t;
      loop(t);
    });
  }

  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;

    if (game.scene === 'playing' && !game.paused) {
      update(dt);
    } else {
      updateAmbient(dt);
    }
    render();
    requestAnimationFrame(loop);
  }

  boot();
})();
