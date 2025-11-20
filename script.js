document.addEventListener('DOMContentLoaded', () => {
    // ⚠️ 백엔드 서버 주소 확인 (Azure VM IP 또는 localhost), URL 뒤에 슬래시(/) 불필요
    const API_BASE_URL = "http://127.0.0.1:8000";

    // 상태 관리 변수
    let currentBook = {
        title: '',
        characters: [],
        generatedImages: []
    };
    let loadingInterval;
    let currentGameObjects = [];
    let currentSlideIndex = 0;
    let chatHistory = [];

    // DOM 요소 선택
    const screens = document.querySelectorAll('.screen');
    const btnStartSetup = document.getElementById('btn-start-setup');
    const btnGotoChars = document.getElementById('btn-goto-chars');
    const btnStartReading = document.getElementById('btn-start-reading');
    const btnAddChar = document.getElementById('btn-add-char');
    const coverUpload = document.getElementById('cover-upload');
    const bookTitleInput = document.getElementById('book-title');
    const charInputsContainer = document.getElementById('char-inputs');
    const pageUpload = document.getElementById('page-upload');
    const chatInput = document.getElementById('chat-input');
    const btnSendChat = document.getElementById('btn-send-chat');
    const chatContainer = document.getElementById('chat-container');
    const mainImage = document.getElementById('main-image');
    const imagePlaceholder = document.getElementById('image-placeholder');
    const btnFinishReading = document.getElementById('btn-finish-reading');
    const btnBackToStart = document.getElementById('btn-back-to-start');
    const galleryContainer = document.getElementById('gallery-container');
    const gallerySlides = document.getElementById('gallery-slides');
    const btnGalleryPrev = document.getElementById('btn-gallery-prev');
    const btnGalleryNext = document.getElementById('btn-gallery-next');
    const galleryPagination = document.getElementById('gallery-pagination');
    
    // 모달 및 게임 요소
    const fullscreenModal = document.getElementById('fullscreen-modal');
    const fullscreenImage = document.getElementById('fullscreen-image');
    const modalClose = document.querySelector('.modal-close');
    const systemModal = document.getElementById('system-modal');
    const systemModalMsg = document.getElementById('system-modal-msg');
    const btnSystemConfirm = document.getElementById('btn-system-confirm');
    const btnSystemCancel = document.getElementById('btn-system-cancel');
    const gameMissionBar = document.getElementById('game-mission-bar');
    const missionTargetName = document.getElementById('mission-target-name');
    const gameToast = document.getElementById('game-toast');


    // ==============================
    // 유틸리티 함수
    // ==============================

    /** 이미지 경로가 'http'로 시작하면 그대로 쓰고, 상대 경로라면 백엔드 주소를 붙여주는 함수
     */
    function resolveImageUrl(url) {
        if (!url) return "";
        // 이미 완전한 주소일 때는 그대로 반환
        if (url.startsWith("http") || url.startsWith("blob:")) return url;
        
        // 슬래시(/)로 시작하는 상대 경로일 때는 API_BASE_URL을 앞에 붙임 (API_BASE_URL 뒤에 슬래시 제거 필요)
        return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    /** 캐릭터 정보 입력 상태에 따른 '시작하기' 버튼 동적 스타일
     */
    function updateStartButtonState() {
        const inputs = charInputsContainer.querySelectorAll('input, textarea');
        let hasInput = false;

        // 하나라도 입력된 값이 있는지 확인
        inputs.forEach(input => { if (input.value.trim() !== '') { hasInput = true; } });
        if (hasInput) {
            btnStartReading.textContent = "좋아! 독서 시작하기";
            btnStartReading.classList.remove('btn-secondary');
        } else {
            btnStartReading.textContent = "건너뛰고 시작하기";
            btnStartReading.classList.add('btn-secondary');
        }
    }

    function showScreen(screenId) {
        if (screenId === 'screen-welcome') document.body.classList.add('welcome-active');
        else document.body.classList.remove('welcome-active');
        screens.forEach(screen => screen.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        window.scrollTo(0, 0);
    }

    function addChatMessage(text, sender) {
        const bubble = document.createElement('div');
        bubble.classList.add('chat-bubble', sender);
        bubble.textContent = text;
        chatContainer.appendChild(bubble);
        chatContainer.scrollTop = chatContainer.scrollHeight; 
    }

    function updateMainImage(imageUrl) {
        if (imageUrl) {
            mainImage.src = resolveImageUrl(imageUrl);
            mainImage.style.display = 'block';
            imagePlaceholder.style.display = 'none';
        } else {
            mainImage.style.display = 'none';
            imagePlaceholder.style.display = 'block';
        }
    }

    /** 채팅 창에 이미지 추가 (게임 기능 + 재생성 버튼 포함 + confidence 필터링)
     */
    function addChatImage(imageUrl, objects = [], sdPrompt = null) {
        // confidence 기반 객체 필터링
        const CONFIDENCE_THRESHOLD = 0.7;
        const validObjects = (objects || []).filter(obj => {
            return obj.confidence >= CONFIDENCE_THRESHOLD;
        });

        // 메시지 그룹 컨테이너(Flexbox) 생성
        const messageGroup = document.createElement('div');
        messageGroup.className = 'chat-message-group';

        // 말풍선 생성
        const bubble = document.createElement('div');
        bubble.classList.add('chat-bubble', 'ai');
        bubble.style.maxWidth = '100%'; // 그룹 내에서 꽉 차게
        bubble.style.margin = '0'; // 그룹이 마진을 담당하므로 초기화

        const container = document.createElement('div');
        container.className = 'chat-image-container';

        const img = document.createElement('img');
        img.src = resolveImageUrl(imageUrl);
        img.style.maxWidth = '100%';
        img.style.borderRadius = '10px';
        img.style.cursor = 'pointer';

        // 필터링된 정답 데이터 저장
        if (validObjects.length > 0) { img.dataset.objects = JSON.stringify(validObjects); }

        // 프롬프트 데이터 저장
        if (sdPrompt) { img.dataset.prompt = sdPrompt; }

        img.addEventListener('click', () => {
            const storedObjects = img.dataset.objects ? JSON.parse(img.dataset.objects) : [];
            openFullscreenModal(img.src, storedObjects);
        });

        container.appendChild(img);

        if (objects && objects.length > 0) {
            const badge = document.createElement('div');
            badge.className = 'game-badge';
            badge.innerHTML = '🔎 찾아봐!';
            container.appendChild(badge);
        }

        bubble.appendChild(container);
        messageGroup.appendChild(bubble);

        // 재생성 버튼 추가
        if (sdPrompt) {
            const regenBtn = document.createElement('button');
            regenBtn.className = 'regenerate-btn';
            regenBtn.innerHTML = '🔄';
            regenBtn.title = "다른 그림 생성";

            regenBtn.addEventListener('click', () => { handleRegenerate(img, regenBtn); });

            messageGroup.appendChild(regenBtn);
        }

        chatContainer.appendChild(messageGroup);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    /** 재생성 버튼 클릭 시 처리 함수
     */
    async function handleRegenerate(imgElement, btnElement) {
        const prompt = imgElement.dataset.prompt;
        if (!prompt) { showToast("이건 다시 그릴 수 없어요 🥲"); return; }
        if (!await showSystemModal("상상력을 발휘해 볼까? 🎨", "confirm")) return;

        btnElement.classList.add('loading');

        const result = await regenerateImage(prompt);

        btnElement.classList.remove('loading');

        if (result && result.imageUrl) {
            // 이미지 소스 교체
            const newUrl = resolveImageUrl(result.imageUrl);
            imgElement.src = newUrl;

            // 정답 데이터 갱신 (Confidence 필터링 포함)
            if (result.objects) {
                const CONFIDENCE_THRESHOLD = 0.7; 
                const validObjects = result.objects.filter(obj => {
                    return obj.confidence === undefined || obj.confidence >= CONFIDENCE_THRESHOLD;
                });
                imgElement.dataset.objects = JSON.stringify(validObjects);
                
                // 이전에 객체가 없어서 배지가 없었다가 이번에 생겼다면 배지를 추가하는 로직 필요
            }

            // 갤러리에 추가
            currentBook.generatedImages.push(result.imageUrl);

            showToast("짜잔! 새로 그린 그림이야! ✨");
        } else {
            showToast("그림을 다시 그리는 데 실패했어 😭");
        }
    }

    /** 여러 줄의 질문 텍스트에서 하나를 랜덤으로 뽑고 정제하는 함수
     */
    function pickRandomQuestion(text) {
        if (!text) return "이 그림에 대해 어떻게 생각해?";

        // 1. 줄바꿈(\n)을 기준으로 나눔
        const questions = text.split('\n');

        // 2. 빈 줄 제거 및 유효한 질문만 필터링
        const validQuestions = questions.filter(q => q.trim().length > 0);

        if (validQuestions.length === 0) return text;

        // 3. 랜덤으로 하나 선택
        const randomIndex = Math.floor(Math.random() * validQuestions.length);
        let selected = validQuestions[randomIndex];

        // 4. 앞부분의 "Q1.", "1.", "- " 등 불필요한 기호 제거 (정규식 사용)
        // ^ : 시작 부분
        // Q? : Q가 있거나 없거나
        // \d+ : 숫자 1개 이상
        // [\.\)] : 점(.)이나 괄호())
        // \s* : 공백
        selected = selected.replace(/^(Q?\d+[\.\)]|-|•)\s*/i, "").trim();

        return selected;
    }

    /** 게임: 미션 바 업데이트
     */
    function updateMissionDisplay() {
        if (currentGameObjects.length > 0) {
            gameMissionBar.style.display = 'block';
            missionTargetName.textContent = currentGameObjects[0].name;
        } else {
            gameMissionBar.style.display = 'none';
            showToast("와! 모두 다 찾았어! 👏👏");
        }
    }

    /** 게임: 토스트 메시지 표시
     */
    function showToast(message) {
        gameToast.textContent = message;
        gameToast.classList.add('show');
        setTimeout(() => { gameToast.classList.remove('show'); }, 2000); 
    }

    function showSystemModal(message, type = 'alert') {
        return new Promise((resolve) => {
            systemModalMsg.textContent = message;
            btnSystemCancel.style.display = (type === 'confirm') ? 'inline-block' : 'none';
            systemModal.classList.add('show');

            const handleConfirm = () => {
                closeSystemModal();
                resolve(true);
            };
            const handleCancel = () => {
                closeSystemModal();
                resolve(false);
            };

            btnSystemConfirm.onclick = handleConfirm;
            btnSystemCancel.onclick = handleCancel;
        });
    }
    function closeSystemModal() { systemModal.classList.remove('show'); }

    function showGallerySlide(index) {
        const totalSlides = gallerySlides.querySelectorAll('.gallery-slide').length;
        if (totalSlides === 0 || (totalSlides === 1 && !gallerySlides.querySelector('img'))) {
            galleryPagination.textContent = "0 / 0";
            btnGalleryPrev.disabled = true;
            btnGalleryNext.disabled = true;
            return;
        }
        currentSlideIndex = Math.max(0, Math.min(index, totalSlides - 1));
        const slideWidth = gallerySlides.clientWidth; 
        gallerySlides.style.transform = `translateX(-${currentSlideIndex * slideWidth}px)`;
        galleryPagination.textContent = `${currentSlideIndex + 1} / ${totalSlides}`;
        btnGalleryPrev.disabled = (currentSlideIndex === 0);
        btnGalleryNext.disabled = (currentSlideIndex === totalSlides - 1);
    }

    function populateGallery() {
        gallerySlides.innerHTML = '';
        if (currentBook.generatedImages.length === 0) {
            gallerySlides.innerHTML = '<div class="gallery-slide"><p>이번 독서에서는 생성된 그림이 없네요.</p></div>';
        } else {
            currentBook.generatedImages.forEach(imageUrl => {
                const slide = document.createElement('div');
                slide.className = 'gallery-slide';
                slide.innerHTML = `<img src="${resolveImageUrl(imageUrl)}" alt="생성된 이야기 그림">`;
                gallerySlides.appendChild(slide);
            });
        }
        showGallerySlide(0); 
    }

    function resetApp() {
        currentBook = { title: '', characters: [], generatedImages: [] };
        currentSlideIndex = 0;
        currentGameObjects = [];
        chatHistory = [];
        bookTitleInput.value = '';
        charInputsContainer.innerHTML = `
            <div class="input-group char-group">
                <input type="text" class="char-name" placeholder="이름 (예: 아기 돼지)">
                <textarea class="char-desc" placeholder="어떻게 생겼어? (예: 분홍색 코, 파란 멜빵바지)"></textarea>
            </div>`;
        updateStartButtonState();
        updateMainImage(null);
        chatContainer.innerHTML = '';
        populateGallery();
        document.body.classList.add('welcome-active');
    }

    function openFullscreenModal(imageUrl, objects = []) {
        if (!imageUrl) return;
        fullscreenImage.src = resolveImageUrl(imageUrl);

        // 원본 배열 복사 (게임 재시작 가능하도록)
        currentGameObjects = JSON.parse(JSON.stringify(objects));

        const oldBoxes = fullscreenModal.querySelectorAll('.correct-box');
        oldBoxes.forEach(box => box.remove());

        // 미션 바 설정
        if (currentGameObjects.length > 0) updateMissionDisplay();
        else gameMissionBar.style.display = 'none';

        fullscreenModal.classList.add('show');
    }
    function closeFullscreenModal() { fullscreenModal.classList.remove('show'); }

    function startLoadingSequence() {
        const messages = [
            "글자를 꼼꼼히 읽고 있어 📖",
            "어떤 그림을 그릴지 생각 중이야 🤔",
            "쓱싹쓱싹 스케치 하는 중 ✏️",
            "팔레트에 물감을 짜고 있어! 🎨",
            "예쁘게 색칠하는 중 ✨",
            "이제 거의 다 됐어! 😄"
        ];
        let msgIndex = 0;

        // 채팅 창: 점 3개(…) 애니메이션
        const bubble = document.createElement('div');
        bubble.classList.add('chat-bubble', 'ai', 'loading-bubble');
        bubble.innerHTML = `
            <div class="loading-dots" style="margin: 5px 0;">
                <span></span><span></span><span></span>
            </div>
        `;
        chatContainer.appendChild(bubble);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // 메인 이미지 영역: 스켈레톤 로딩
        mainImage.style.display = 'none';
        imagePlaceholder.style.display = 'none';

        // 기존 오버레이 제거
        const oldOverlay = document.getElementById('loading-text-overlay');
        if (oldOverlay) oldOverlay.remove();

        // 새 오버레이 생성
        const overlay = document.createElement('div');
        overlay.id = 'loading-text-overlay';
        overlay.innerHTML = `<div id="loading-text-message">${messages[0]}</div>`;
        document.getElementById('image-display-area').appendChild(overlay);

        // 텍스트 순환 (6초 간격)
        const textElement = document.getElementById('loading-text-message');
        loadingInterval = setInterval(() => {
            msgIndex = (msgIndex + 1) % messages.length;
            if (textElement) {
                textElement.classList.add('fade-text');
                setTimeout(() => {
                    textElement.textContent = messages[msgIndex];
                    textElement.classList.remove('fade-text');
                }, 500); // CSS transition 값과 맞춤
            }
        }, 6000);
    }

    function stopLoadingSequence() {
        clearInterval(loadingInterval);

        // 로딩 버블 및 스켈레톤 제거
        const loadingBubble = document.querySelector('.loading-bubble');
        if (loadingBubble) loadingBubble.remove();
        const overlay = document.getElementById('loading-text-overlay');
        if (overlay) overlay.remove();
    }


    // ==============================
    // 이벤트 리스너
    // ==============================

    btnStartSetup.addEventListener('click', () => showScreen('screen-setup-book'));

    // 책 표지 업로드 (API 1: analyze-cover)
    coverUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // 백엔드 호출: 표지 분석
        const result = await analyzeBookCover(file);

        if (result && result.title) {
            // 명세 임시 변경에 따라, DB 조회 없이 title만 받아옴
            bookTitleInput.value = result.title;
            currentBook.title = result.title;
        } else {
            showSystemModal("앗, 책 제목을 읽지 못했어. 🥲 직접 입력해줄래?", "alert");
        }
        event.target.value = null;
    });

    btnGotoChars.addEventListener('click', () => {
        currentBook.title = bookTitleInput.value;
        if (!currentBook.title) {
            showSystemModal("책 제목을 입력하거나 표지를 보여줘!", "alert");
            return;
        }
        showScreen('screen-setup-chars');
        updateStartButtonState();
    });

    btnAddChar.addEventListener('click', () => {
        const charGroup = document.createElement('div');
        charGroup.classList.add('input-group', 'char-group', 'enter');
        charGroup.innerHTML = `
            <input type="text" class="char-name" placeholder="이름 (예: 아기 돼지)">
            <textarea class="char-desc" placeholder="어떻게 생겼어? (예: 분홍색 코, 파란 멜빵바지)"></textarea>
            <button type="button" class="btn-delete-char">×</button>
        `;
        charInputsContainer.appendChild(charGroup);

        setTimeout(() => charGroup.classList.remove('enter'), 300);
        charGroup.scrollIntoView({ behavior: 'smooth'});
        updateStartButtonState();
    });

    charInputsContainer.addEventListener('input', () => {
        updateStartButtonState();
    });
    charInputsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-delete-char')) {
            const targetGroup = event.target.closest('.input-group');
            targetGroup.classList.add('leave');
            setTimeout(() => {
                targetGroup.remove();
                updateStartButtonState();
            }, 300); // CSS transition 값과 맞춤
        }
    });

    btnStartReading.addEventListener('click', async () => {
        currentBook.characters = [];
        const charGroups = charInputsContainer.querySelectorAll('.char-group');
        for (const group of charGroups) {
            const name = group.querySelector('.char-name').value;
            const desc = group.querySelector('.char-desc').value;
            if (name) {
                currentBook.characters.push({ name, desc });
            } else if (desc) {
                await showSystemModal("설명한 캐릭터의 '이름'을 입력해줘!", "alert");
                group.querySelector('.char-name').focus();
                return;
            }
        }
        if (currentBook.characters.length === 0) {
            if (!await showSystemModal("캐릭터 설명 없이 시작할까?", "confirm")) return;
        }

        addChatMessage(`좋아! '${currentBook.title || '이'}' 책을 읽어보자. 책 페이지를 찍어서 올려주면 그림을 그려줄게!`, "ai");
        showScreen('screen-reading');
    });

    // 페이지 업로드 (API 2: process-page)
    pageUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        startLoadingSequence();

        // 백엔드 호출: 통합 처리 (OCR -> 프롬프트 -> 이미지 생성 -> 객체 탐지)
        const result = await processBookPage(file);

        stopLoadingSequence();

        // 디버깅용
        console.log("API 2 응답 (result):", result);

        if (result) {
            // 이미지 표시
            if (result.imageUrl) {
                updateMainImage(result.imageUrl);
                currentBook.generatedImages.push(result.imageUrl);
            }

            // 채팅 창에 이미지 추가 (게임 데이터 'objects' 포함)
            addChatImage(result.imageUrl, result.objects, result.sd_prompt);

            // AI 질문 처리 (aiQuestion 필드 사용)
            let aiMsg = `"${result.ocrText}"라는 내용의 장면을 그려봤어. 어때?`;
            if (result.aiQuestion) { aiMsg = pickRandomQuestion(result.aiQuestion); }
            addChatMessage(aiMsg, "ai");

            // AI가 한 질문을 히스토리에 저장 (role: model)
            chatHistory.push({ role: "model", message: aiMsg });
        } else {
            imagePlaceholder.style.display = 'block';
            addChatMessage("앗, 그림을 그리다가 실패했어... 😭 나중에 다시 시도해줄래?", "ai");
        }
        event.target.value = null;
    });

    // 채팅 보내기 (API 3: chat)
    btnSendChat.addEventListener('click', async () => {
        const userText = chatInput.value;
        if (!userText) return;
        addChatMessage(userText, "user");
        chatInput.value = "";

        // 1. 사용자 메시지를 히스토리에 저장 (role: user)
        // (백엔드로 보내기 전에 먼저 저장하지 않음 - 백엔드 구조에 따라 다를 수 있지만 보통 요청 시엔 history에 포함하지 않고 message로 따로 보냄)
        // 하지만 다음 턴을 위해 저장은 필수입니다.
        
        // [API 호출] 현재 히스토리를 함께 전송
        // 주의: 방금 입력한 userText는 'message' 필드로 가므로 history에는 아직 안 넣거나, 백엔드 로직에 따라 다름.
        // 일반적인 챗봇 로직에서는 "이전 기록(history)" + "현재 말(message)"로 구성하므로
        // 여기서는 호출 직전에 넣지 않고 호출 후에 넣거나, 백엔드가 history에 현재 메시지를 포함하길 기대하지 않는다면 호출 시점엔 넣지 않습니다.
        // 안전하게: 호출할 때는 '이전 대화'만 보내고, 호출 후에 '이번 대화'를 저장합니다.
        
        const reply = await getChatResponse(userText, chatHistory);

        addChatMessage(reply, "ai");

        // 대화가 끝난 후 이번 턴의 대화 내용을 히스토리에 누적
        chatHistory.push({ role: "user", message: userText });
        chatHistory.push({ role: "model", message: reply });
    });

    // 게임: 이미지 클릭 시 정답 판정
    fullscreenImage.addEventListener('click', (event) => {
        if (!currentGameObjects || currentGameObjects.length === 0) return;
        const rect = fullscreenImage.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        let foundIndex = -1;
        currentGameObjects.forEach((obj, index) => {
            const bbox = obj.boundingBox;
            if (!bbox) return;
            const boxX = bbox.left * rect.width;
            const boxY = bbox.top * rect.height;
            const boxW = bbox.width * rect.width;
            const boxH = bbox.height * rect.height;
            if (clickX >= boxX && clickX <= boxX + boxW && clickY >= boxY && clickY <= boxY + boxH) {
                foundIndex = index;
            }
        });
        if (foundIndex !== -1) {
            const obj = currentGameObjects[foundIndex];
            const bbox = obj.boundingBox;
            const correctBox = document.createElement('div');
            correctBox.className = 'correct-box';
            correctBox.style.position = 'fixed'; 
            correctBox.style.left = (rect.left + bbox.left * rect.width) + 'px';
            correctBox.style.top = (rect.top + bbox.top * rect.height) + 'px';
            correctBox.style.width = (bbox.width * rect.width) + 'px';
            correctBox.style.height = (bbox.height * rect.height) + 'px';
            fullscreenModal.appendChild(correctBox);
            showToast(`${obj.name}! 거기에 있었네! 🎉`);
            currentGameObjects.splice(foundIndex, 1);
            updateMissionDisplay();
        }
    });

    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            btnSendChat.click();
        }
    });
    btnFinishReading.addEventListener('click', async () => {
        if (await showSystemModal("독서를 정말 마칠까요? 📚", "confirm")) {
            populateGallery();
            showScreen('screen-gallery');
        }
    });
    btnBackToStart.addEventListener('click', () => {
        resetApp();
        showScreen('screen-welcome');
    });
    btnGalleryPrev.addEventListener('click', () => showGallerySlide(currentSlideIndex - 1));
    btnGalleryNext.addEventListener('click', () => showGallerySlide(currentSlideIndex + 1));
    modalClose.addEventListener('click', closeFullscreenModal);
    fullscreenModal.addEventListener('click', (event) => {
        if (event.target === fullscreenModal) {
            closeFullscreenModal();
        }
    });
    mainImage.addEventListener('click', () => openFullscreenModal(mainImage.src));
    gallerySlides.addEventListener('click', (event) => {
        if (event.target.tagName === 'IMG') {
            openFullscreenModal(event.target.src);
        }
    });


    // ==============================
    // API 통신 함수
    // ==============================

    /** * [API 1] 책 표지 분석 
     * 명세: 응답 { "title": "..." }
     */
    async function analyzeBookCover(file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch(`${API_BASE_URL}/api/analyze-cover`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Network error');
            return await response.json();
        } catch (error) {
            console.error("API 1 Error:", error);
            return null;
        }
    }

    /** * [API 2] 페이지 통합 처리
     * 명세: 응답 { ocrText, imageUrl, objects, aiQuestion }
     */
    async function processBookPage(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/api/process-page`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Processing failed');
            return await response.json(); 
        } catch (error) {
            console.error("API 2 Error:", error);
            return null;
        }
    }

    /** * [API 3] 채팅
     * 명세: 응답 { "reply": "..." }
     */
    async function getChatResponse(userText, chatHistory) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userText, history: chatHistory })
            });
            const data = await response.json();
            return data.reply;
        } catch (error) {
            console.error("API 3 Error:", error);
            return "미안, 지금은 대답하기 어려워 😅";
        }
    }

    /** * [API 4] 이미지 재생성
     * 명세: 요청 { prompt: "..." } -> 응답 { imageUrl, objects }
     */
    async function regenerateImage(prompt) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/regenerate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt })
            });
            if (!response.ok) throw new Error('Regeneration failed');
            return await response.json();
        } catch (error) {
            console.error("API 4 Error:", error);
            return null;
        }
    }

    // 앱 시작
    showScreen('screen-welcome');
});