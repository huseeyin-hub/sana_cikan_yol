// --- KİŞİSELLEŞTİRME ALANI ---
// Lütfen buradaki tırnak içindeki alanları kendi hikayenize göre doldur.
const CONFIG = {
    sevgilininAdi: 'Serra', // Onun adı
    benimAdim: 'Hüseyin', // Senin adın
    tanismaTarihi: 'her şeyin başladığı o ilk gün 22.10.2026',
    iliskiBaslangici: 'maceramıza adım attığımız o an 01.12.2026',
    bizeOzelAni: 'İlk buluştuğumuz gün içimde ki tarif edilemez duygular',
    icSakamiz: 'askim sıkıntı kucuk',
    sonMesajim: 'Aramızdaki yollar ne kadar uzun olursa olsun, attığım her adım daima sana çıkıyor. Seni çok seviyorum.'
};

// Değerlerin boş bırakılma ihtimaline karşı varsayılan atamalar
const getConf = (key) => CONFIG[key] && CONFIG[key].trim() !== '' ? CONFIG[key] : 'o an';
const sAdi = getConf('sevgilininAdi');
const bAdi = getConf('benimAdim');

// --- OYUN MOTORU VE DURUM ---
let gameState = {
    currentScene: 'scene1',
    inventory: [],
    romanticScore: 0,
    humorScore: 0,
    audioEnabled: false
};

const STORAGE_KEY = 'sanaCikanYol_save';
let typeWriterTimeout;
let activeMiniGame = null;

// Ses Efektleri (Sessiz modda çalışabilmesi için sahte osilatörler)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if (!gameState.audioEnabled || audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'click') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'success') {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
}

// --- HİKAYE DÜĞÜMLERİ (SCENES) ---
const scenes = {
    scene1: {
        bg: 'bg-night',
        text: `Gözlerini açtığında kendini hiç bilmediğin, ama bir o kadar da tanıdık hissettiren yıldızlı bir gökyüzünün altında buluyorsun. Hafif bir esinti var. İçinde sadece tek bir his var: ${bAdi}'e ulaşmalıyım.`,
        choices: [
            { text: "Ufuktaki parlayan patikaya doğru yürü.", next: "scene2_path", action: () => gameState.romanticScore++ },
            { text: "Önce gökyüzüne bakıp nerede olduğunu anla.", next: "scene2_sky" }
        ]
    },
    scene2_path: {
        bg: 'bg-night',
        text: "Patika boyunca ilerlerken, yerde parlayan bazı işaretler görüyorsun. Gökyüzündeki yıldızlar sanki sana bir yol çizmek ister gibi titriyor.",
        choices: [
            { text: "Yıldızların mesajını çözmeye çalış.", next: "minigame_stars" }
        ]
    },
    scene2_sky: {
        bg: 'bg-night',
        text: "Gökyüzü o kadar berrak ki... Tıpkı beraber geçirdiğiniz o sakin akşamlar gibi. Yıldızların dizilimi sana bir haritayı andırıyor.",
        choices: [
            { text: "Yıldızları zihninde birleştir.", next: "minigame_stars" }
        ]
    },
    scene3: {
        bg: 'bg-forest',
        text: "Yıldızlar sana yolu gösterdikten sonra, etrafı çiçeklerle kaplı bir ormana giriyorsun. Eski bir ağacın kovuğunda katlanmış bir mektup duruyor.",
        choices: [
            { text: "Mektubu hemen aç ve oku.", next: "scene3_read", action: () => gameState.romanticScore++ },
            { text: "Kaybolmaması için cebine koy, yola devam et.", next: "scene4" }
        ]
    },
    scene3_read: {
        bg: 'bg-forest',
        text: `Mektupta senin el yazınla şu yazıyor: "${sAdi}, bu satırları okuyorsan bana yaklaşıyorsun demektir. İlk günümüzü, ${CONFIG.tanismaTarihi} anını hatırla. O gün de kalbim böyle çarpıyordu."`,
        choices: [
            { text: "Gülümseyerek yola devam et.", next: "scene4" }
        ]
    },
    scene4: {
        bg: 'bg-forest',
        text: "Ormanın derinliklerinde, havada asılı duran küçük, parlayan anı parçacıkları görüyorsun. Sanki zihninizdeki ortak hatıralar buraya saçılmış gibi.",
        choices: [
            { text: "Anıları bir araya getirmeyi dene.", next: "minigame_memory" },
            { text: "Dokunmadan sessizce yanlarından geç.", next: "scene5" }
        ]
    },
    scene5: {
        bg: 'bg-night',
        text: "Orman bittiğinde karşına sisler içinde bir nehir çıkıyor. Üzerindeki asma köprü oldukça yıpranmış görünüyor.",
        choices: [
            { text: "Cesurca köprüden geçmeyi dene.", next: "scene6" },
            { text: "Gizli bir geçit ara.", next: "scene5_secret", condition: () => gameState.inventory.includes('harita') }
        ]
    },
    scene5_secret: {
        bg: 'bg-sunset',
        text: "Yıldızlardan aldığın harita sayesinde nehrin altından geçen, mor kristallere aydınlatılmış gizli ve güvenli bir yol buluyorsun. Bu yol sana enerji veriyor.",
        choices: [
            { text: "Işıltılı tünelden ilerle.", next: "scene6", action: () => { gameState.inventory.push('kristal'); gameState.romanticScore += 2; } }
        ]
    },
    scene6: {
        bg: 'bg-night',
        text: "Yol bir anda karanlıklaşıyor. Görüş mesafen sıfıra iniyor. Sadece kendi kalp atışını ve uzaklardan gelen bir sesi duyabiliyorsun. Adımlarını kalbinin ritmine uydurman gerek.",
        choices: [
            { text: "Derin bir nefes al ve ritme odaklan.", next: "minigame_rhythm" }
        ]
    },
    scene7: {
        bg: 'bg-sunset',
        text: "Karanlığı aştığında, devasa bir gün batımı manzarasıyla karşılaşıyorsun. Yolun sonunda, silüeti sana çok tanıdık gelen biri var. Kalbin hızla atmaya başlıyor. Ona sesleneceksin...",
        choices: [
            { text: `Gülümseyerek bağır: "${CONFIG.icSakamiz}"`, next: "ending_humor", action: () => gameState.humorScore += 5 },
            { text: "Sessizce yanına yaklaş ve elini tut.", next: "ending_check" }
        ]
    },
    ending_check: {
        bg: 'bg-sunset',
        text: "Zaman durmuş gibi...",
        choices: [
            { text: "Gözlerinin içine bak...", next: "calculate_ending" }
        ]
    },
    ending_humor: {
        bg: 'bg-light',
        text: `Bu sözleri duyar duymaz kahkahayı basıyor. "Bunca yolu bunu söylemek için mi geldin?" diyor gülerek. Sonra sana sıkıca sarılıyor. Eğlenceli, samimi ve tamamen size ait bir an. "${CONFIG.sonMesajim}"`,
        choices: [ { text: "Oyunu Bitir", next: "credits" } ]
    },
    ending_romantic: {
        bg: 'bg-sunset',
        text: `Sana dönüyor. Gözlerinde hem özlem hem de büyük bir sevgi var. "${bAdi}..." diyorsun fısıltıyla. Ellerinizi birleştirdiğinizde tüm evrenin rengi değişiyor. "${CONFIG.sonMesajim}"`,
        choices: [ { text: "Oyunu Bitir", next: "credits" } ]
    },
    ending_secret: {
        bg: 'bg-night',
        text: `Tüm anıları (${CONFIG.bizeOzelAni}) eksiksiz topladığın ve yolculuğu mükemmel tamamladığın için etrafınızda bir ışık halesi oluşuyor. Mesafeler, zorluklar... Hepsi birer oyundu. Gerçek olan tek şey bu bağ. "${CONFIG.sonMesajim}"`,
        choices: [ { text: "Oyunu Bitir", next: "credits" } ]
    },
    credits: {
        bg: 'bg-night',
        text: `Oynadığın için teşekkürler ${sAdi}. Bu küçük oyun, sana olan sevgimin dijital bir yansımasıydı. - ${bAdi}`,
        choices: [ { text: "Ana Menüye Dön", next: "start" } ]
    }
};

// --- MİNİ OYUNLAR ---
const MiniGames = {
    stars: {
        title: "Yıldız Haritası",
        instruction: "Yıldızlara sırayla tıklayarak yolu aydınlat.",
        render: (container, onComplete) => {
            container.innerHTML = '';
            const coords = [{x: 20, y: 20}, {x: 80, y: 30}, {x: 40, y: 70}, {x: 70, y: 80}];
            let currentStep = 0;
            
            coords.forEach((c, index) => {
                let star = document.createElement('div');
                star.className = 'star-dot';
                star.style.left = c.x + '%';
                star.style.top = c.y + '%';
                star.style.opacity = index === 0 ? '1' : '0.3';
                
                star.onclick = () => {
                    if (index === currentStep) {
                        playSound('click');
                        star.classList.add('active');
                        currentStep++;
                        if (currentStep < coords.length) {
                            container.children[currentStep].style.opacity = '1';
                        } else {
                            setTimeout(() => {
                                playSound('success');
                                showNotification("Bir harita parçası buldun!");
                                gameState.inventory.push('harita');
                                onComplete('scene3');
                            }, 500);
                        }
                    }
                };
                container.appendChild(star);
            });
        }
    },
    memory: {
        title: "Anı Parçacıkları",
        instruction: "Aynı sembolleri eşleştirerek anıyı tamamla.",
        render: (container, onComplete) => {
            container.innerHTML = '<div class="memory-grid"></div>';
            const grid = container.querySelector('.memory-grid');
            const symbols = ['❤️', '✨', '🎮', '❤️', '✨', '🎮'];
            symbols.sort(() => Math.random() - 0.5);
            
            let flipped = [];
            let matched = 0;
            
            symbols.forEach((sym) => {
                let card = document.createElement('div');
                card.className = 'memory-card';
                card.dataset.sym = sym;
                card.innerHTML = '<span>?</span>';
                
                card.onclick = () => {
                    if (flipped.length < 2 && !card.classList.contains('flipped')) {
                        playSound('click');
                        card.classList.add('flipped');
                        card.innerHTML = sym;
                        flipped.push(card);
                        
                        if (flipped.length === 2) {
                            setTimeout(() => {
                                if (flipped[0].dataset.sym === flipped[1].dataset.sym) {
                                    matched += 2;
                                    playSound('success');
                                    if (matched === symbols.length) {
                                        showNotification("Özel bir anı hatırladın: " + CONFIG.bizeOzelAni);
                                        gameState.inventory.push('ani');
                                        setTimeout(() => onComplete('scene5'), 1500);
                                    }
                                } else {
                                    flipped.forEach(c => { c.classList.remove('flipped'); c.innerHTML = '<span>?</span>'; });
                                }
                                flipped = [];
                            }, 800);
                        }
                    }
                };
                grid.appendChild(card);
            });
        }
    },
    rhythm: {
        title: "Kalp Ritmi",
        instruction: "Çizgi pembe alanın içindeyken butona bas.",
        render: (container, onComplete) => {
            container.innerHTML = `
                <div class="rhythm-bar-container">
                    <div class="rhythm-target"></div>
                    <div class="rhythm-cursor" id="r-cursor"></div>
                </div>
                <button class="rhythm-btn" id="r-btn">RİTME UY</button>
            `;
            const cursor = container.querySelector('#r-cursor');
            const btn = container.querySelector('#r-btn');
            let pos = 0;
            let dir = 1;
            let speed = 2;
            let hits = 0;
            
            let anim = setInterval(() => {
                pos += dir * speed;
                if (pos > 95 || pos < 0) dir *= -1;
                cursor.style.left = pos + '%';
            }, 20);
            
            btn.onclick = () => {
                if (pos >= 40 && pos <= 60) {
                    hits++;
                    playSound('success');
                    speed += 1; // Zorlaşır
                    btn.style.background = '#4ade80';
                    setTimeout(() => btn.style.background = 'var(--color-accent)', 200);
                    if (hits >= 3) {
                        clearInterval(anim);
                        showNotification("Kalp atışların dengelendi.");
                        gameState.inventory.push('ritim');
                        setTimeout(() => onComplete('scene7'), 1000);
                    }
                } else {
                    playSound('click');
                    btn.style.background = '#ef4444';
                    setTimeout(() => btn.style.background = 'var(--color-accent)', 200);
                }
            };
            
            // Temizleme için dışarıya fonksiyon sızdırma
            container.dataset.clear = () => clearInterval(anim);
        }
    }
};

// --- ARAYÜZ VE KONTROLLER ---
const ui = {
    menu: document.getElementById('main-menu'),
    story: document.getElementById('story-screen'),
    minigame: document.getElementById('minigame-screen'),
    bgLayer: document.getElementById('background-layer'),
    dialogueText: document.getElementById('dialogue-text'),
    choicesBox: document.getElementById('choices-container'),
    notiBox: document.getElementById('notification-box')
};

function initGame() {
    createParticles();
    loadProgress();
    
    document.getElementById('btn-new-game').onclick = () => {
        playSound('click');
        gameState = { currentScene: 'scene1', inventory: [], romanticScore: 0, humorScore: 0, audioEnabled: gameState.audioEnabled };
        saveProgress();
        startGame();
    };
    
    document.getElementById('btn-continue').onclick = () => {
        playSound('click');
        startGame();
    };
    
    document.getElementById('btn-reset').onclick = () => {
        playSound('click');
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    };

    document.getElementById('btn-audio-toggle').onclick = (e) => {
        gameState.audioEnabled = !gameState.audioEnabled;
        if (gameState.audioEnabled && audioCtx.state === 'suspended') audioCtx.resume();
        e.target.innerText = gameState.audioEnabled ? 'Ses: Açık 🔊' : 'Ses: Kapalı 🔇';
        saveProgress();
    };
}

function startGame() {
    ui.menu.classList.add('hidden');
    renderScene(gameState.currentScene);
}

function renderScene(sceneKey) {
    if (sceneKey === 'start') {
        location.reload();
        return;
    }
    
    if (sceneKey === 'calculate_ending') {
        if (gameState.inventory.length >= 3) sceneKey = 'ending_secret';
        else if (gameState.humorScore > 0) sceneKey = 'ending_humor';
        else sceneKey = 'ending_romantic';
    }

    if (sceneKey.startsWith('minigame_')) {
        startMiniGame(sceneKey.split('_')[1]);
        return;
    }

    gameState.currentScene = sceneKey;
    saveProgress();
    
    const scene = scenes[sceneKey];
    ui.story.classList.remove('hidden');
    ui.minigame.classList.add('hidden');
    
    ui.bgLayer.className = scene.bg;
    ui.choicesBox.innerHTML = '';
    
    // Typewriter effect
    clearTimeout(typeWriterTimeout);
    ui.dialogueText.innerHTML = '';
    let i = 0;
    function typeWriter() {
        if (i < scene.text.length) {
            ui.dialogueText.innerHTML += scene.text.charAt(i);
            i++;
            typeWriterTimeout = setTimeout(typeWriter, 30); // Yazı hızı
        } else {
            showChoices(scene.choices);
        }
    }
    typeWriter();
}

function showChoices(choices) {
    ui.choicesBox.innerHTML = '';
    choices.forEach(choice => {
        if (choice.condition && !choice.condition()) return;
        
        let btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerText = choice.text;
        btn.onclick = () => {
            playSound('click');
            if (choice.action) choice.action();
            ui.dialogueText.innerHTML = '';
            ui.choicesBox.innerHTML = '';
            renderScene(choice.next);
        };
        ui.choicesBox.appendChild(btn);
    });
}

function startMiniGame(gameKey) {
    ui.story.classList.add('hidden');
    ui.minigame.classList.remove('hidden');
    
    const mg = MiniGames[gameKey];
    document.getElementById('minigame-title').innerText = mg.title;
    document.getElementById('minigame-instruction').innerText = mg.instruction;
    
    const area = document.getElementById('minigame-area');
    if (area.dataset.clear) area.dataset.clear(); // Varsa eski animasyonu temizle
    
    mg.render(area, (nextScene) => {
        ui.minigame.classList.add('hidden');
        renderScene(nextScene);
    });

    // Geçme butonu (Eğer çok zorlanırsa diye)
    let skipBtn = document.getElementById('btn-minigame-skip');
    skipBtn.classList.remove('hidden');
    skipBtn.onclick = () => {
        playSound('click');
        if (area.dataset.clear) area.dataset.clear();
        ui.minigame.classList.add('hidden');
        
        // Atlandığı için ödül verilmez, direkt bir sonraki varsayılan sahneye gider
        let defaultNext = gameKey === 'stars' ? 'scene3' : (gameKey === 'memory' ? 'scene5' : 'scene7');
        renderScene(defaultNext);
    };
}

// --- YARDIMCI FONKSİYONLAR ---
function showNotification(msg) {
    ui.notiBox.innerText = msg;
    ui.notiBox.classList.remove('hidden');
    setTimeout(() => ui.notiBox.classList.add('hidden'), 3000);
}

function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
}

function loadProgress() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        gameState = JSON.parse(saved);
        document.getElementById('btn-continue').classList.remove('hidden');
        document.getElementById('btn-reset').classList.remove('hidden');
        
        if (gameState.audioEnabled) {
            document.getElementById('btn-audio-toggle').innerText = 'Ses: Açık 🔊';
        }
    }
}

function createParticles() {
    const layer = document.getElementById('particle-layer');
    setInterval(() => {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + 'vw';
        let size = Math.random() * 4 + 2;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.animationDuration = (Math.random() * 3 + 2) + 's';
        layer.appendChild(p);
        
        setTimeout(() => p.remove(), 5000);
    }, 300);
}

// Oyunu başlat
window.onload = initGame;