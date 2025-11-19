document.addEventListener('DOMContentLoaded', () => {
    // [중요] 백엔드 서버 주소 (Azure VM IP로 변경 필요)
    const API_BASE_URL = "http://20.214.252.252:8000";

    // 상태 관리 변수
    let currentBook = {
        title: '',
        characters: [],
        generatedImages: []
    };
    let currentSlideIndex = 0;
    let currentGameObjects = []; // 현재 게임 진행 상태 변수 (복사본)

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

    // 모달 및 게임 관련 요소
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

    function showScreen(screenId) {
        if (screenId === 'screen-welcome') {
            document.body.classList.add('welcome-active');
        } else {
            document.body.classList.remove('welcome-active');
        }

        screens.forEach(screen => {
            screen.classList.remove('active');
        });
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
            mainImage.src = imageUrl;
            mainImage.style.display = 'block';
            imagePlaceholder.style.display = 'none';
        } else {
            mainImage.style.display = 'none';
            imagePlaceholder.style.display = 'block';
        }
    }

    /**
     * 채팅 창에 이미지 추가 (게임 기능 포함)
     */
    function addChatImage(imageUrl, objects = []) {
        const bubble = document.createElement('div');
        bubble.classList.add('chat-bubble', 'ai');

        const container = document.createElement('div');
        container.className = 'chat-image-container';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '10px';
        img.style.cursor = 'pointer';

        // 이미지 태그에 정답 데이터 저장 (데이터셋 활용)
        if (objects && objects.length > 0) {
            img.dataset.objects = JSON.stringify(objects); 
        }

        // 이미지 클릭 시 모달 열기 (데이터셋에서 읽어오기)
        img.addEventListener('click', () => {
            const storedObjects = img.dataset.objects ? JSON.parse(img.dataset.objects) : [];
            openFullscreenModal(imageUrl, storedObjects);
        });

        container.appendChild(img);

        if (objects && objects.length > 0) {
            const badge = document.createElement('div');
            badge.className = 'game-badge';
            badge.innerHTML = '🔎 찾아봐!';
            container.appendChild(badge);
        }

        bubble.appendChild(container);
        chatContainer.appendChild(bubble);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // 게임: 미션 바 업데이트
    function updateMissionDisplay() {
        if (currentGameObjects.length > 0) {
            gameMissionBar.style.display = 'block';
            // 남은 것 중 첫 번째를 목표로 제시
            missionTargetName.textContent = currentGameObjects[0].name;
        } else {
            gameMissionBar.style.display = 'none';
            showToast("와! 모두 다 찾았어! 👏👏");
        }
    }

    // 게임: 토스트 메시지 표시
    function showToast(message) {
        gameToast.textContent = message;
        gameToast.classList.add('show');

        setTimeout(() => {
            gameToast.classList.remove('show');
        }, 2000); 
    }

    /**
     * 시스템 모달 (Alert/Confirm)
     */
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

    function closeSystemModal() {
        systemModal.classList.remove('show');
    }

    // 갤러리 슬라이드 이동
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

    // 갤러리 채우기
    function populateGallery() {
        gallerySlides.innerHTML = '';
        if (currentBook.generatedImages.length === 0) {
            gallerySlides.innerHTML = '<div class="gallery-slide"><p>이번 독서에서는 생성된 그림이 없네요.</p></div>';
        } else {
            currentBook.generatedImages.forEach(imgUrl => {
                const slide = document.createElement('div');
                slide.className = 'gallery-slide';
                slide.innerHTML = `<img src="${imgUrl}" alt="생성된 이야기 그림">`;
                gallerySlides.appendChild(slide);
            });
        }
        showGallerySlide(0);
    }

    function resetApp() {
        currentBook = { title: '', characters: [], generatedImages: [] };
        currentSlideIndex = 0;
        bookTitleInput.value = '';
        charInputsContainer.innerHTML = `
            <div class="input-group char-group">
                <input type="text" class="char-name" placeholder="이름 (예: 아기 돼지)">
                <textarea class="char-desc" placeholder="어떻게 생겼어? (예: 분홍색 코, 파란 멜빵바지)"></textarea>
            </div>`;
        updateMainImage(null);
        chatContainer.innerHTML = '';
        populateGallery();
        document.body.classList.add('welcome-active');
    }

    function openFullscreenModal(imageUrl, objects = []) {
        if (!imageUrl) return;
        fullscreenImage.src = imageUrl;
        currentGameObjects = JSON.parse(JSON.stringify(objects));
        const oldBoxes = fullscreenModal.querySelectorAll('.correct-box');
        oldBoxes.forEach(box => box.remove());
        if (currentGameObjects.length > 0) updateMissionDisplay();
        else gameMissionBar.style.display = 'none';
        fullscreenModal.classList.add('show');
    }
    function closeFullscreenModal() { fullscreenModal.classList.remove('show'); }


    // 🔽 이벤트 리스너 🔽

    btnStartSetup.addEventListener('click', () => showScreen('screen-setup-book'));

    coverUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        addChatMessage("책 표지를 분석 중이야... 🔍", "ai");
        
        // [API] 책 표지 분석 (DB 조회 포함)
        const result = await analyzeBookCover(file);
        
        if (result && result.title) {
            bookTitleInput.value = result.title;
            currentBook.title = result.title;
            
            if (result.characters && result.characters.length > 0) {
                charInputsContainer.innerHTML = ''; 
                result.characters.forEach(char => {
                     const charGroup = document.createElement('div');
                     charGroup.classList.add('input-group', 'char-group');
                     charGroup.innerHTML = `
                        <input type="text" class="char-name" value="${char.name || ''}">
                        <textarea class="char-desc" placeholder="어떻게 생겼어?">${char.desc || ''}</textarea>
                        <button type="button" class="btn-delete-char">×</button>
                    `;
                    charInputsContainer.appendChild(charGroup);
                });
                addChatMessage(`'${result.title}' 책이구나! 친구들도 미리 불러왔어.`, "ai");
            } else {
                addChatMessage(`'${result.title}' 책이 맞니? 등장인물은 직접 알려줘!`, "ai");
            }
        } else {
            addChatMessage("책 제목을 읽지 못했어. 직접 입력해줄래?", "ai");
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
    });

    btnAddChar.addEventListener('click', () => {
        const charGroup = document.createElement('div');
        charGroup.classList.add('input-group', 'char-group');
        charGroup.innerHTML = `
            <input type="text" class="char-name" placeholder="이름 (예: 아기 돼지)">
            <textarea class="char-desc" placeholder="어떻게 생겼어? (예: 분홍색 코, 파란 멜빵바지)"></textarea>
            <button type="button" class="btn-delete-char">×</button>
        `;
        charInputsContainer.appendChild(charGroup);
        charGroup.scrollIntoView({ behavior: 'smooth'});
    });

    charInputsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-delete-char')) {
            event.target.closest('.input-group').remove();
        }
    });

    btnStartReading.addEventListener('click', async () => {
        currentBook.characters = [];
        const charGroups = charInputsContainer.querySelectorAll('.char-group');
        for (const group of charGroups) {
            const name = group.querySelector('.char-name').value;
            const desc = group.querySelector('.char-desc').value;
            if (name) {
                // 여기서는 간단히 추가만 하고, 실제 검증은 백엔드나 추후 수행 가능
                currentBook.characters.push({ name, desc });
            } else if (desc) {
                await showSystemModal("등장인물의 '이름'을 꼭 입력해줘!", "alert");
                group.querySelector('.char-name').focus();
                return;
            }
        }
        addChatMessage(`좋아! '${currentBook.title || '이 책'}' 읽기를 시작하자. 책 페이지를 찍어서 올려주면 그림을 그려줄게!`, "ai");
        showScreen('screen-reading');
    });

    // [핵심 수정] 통합된 페이지 업로드 및 처리
    pageUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        addChatMessage("페이지를 읽고 그림을 그리고 있어... (조금 걸릴 수 있어!) 🎨", "ai");
        updateMainImage(null); 

        // [API] 페이지 처리 통합 요청
        // OCR -> 프롬프트 -> 이미지 생성 -> 객체 탐지를 백엔드에서 한 번에!
        const result = await processBookPage(file, currentBook.characters);

        if (result) {
            // 1. 이미지 업데이트
            if (result.imageUrl) {
                updateMainImage(result.imageUrl);
                currentBook.generatedImages.push(result.imageUrl);
            }

            // 2. 채팅창에 이미지 추가 (게임 데이터 포함)
            addChatImage(result.imageUrl, result.objects);

            // 3. AI 질문 출력
            // 백엔드에서 질문(aiQuestion)을 보내주면 그걸 쓰고, 없으면 기본 문구 사용
            const aiMsg = result.aiQuestion || `"${result.ocrText}" 장면을 그려봤어. 어때?`;
            addChatMessage(aiMsg, "ai");

        } else {
            addChatMessage("앗, 그림을 그리는 도중에 문제가 생겼어. 다시 시도해줄래?", "ai");
        }

        event.target.value = null;
    });

    btnSendChat.addEventListener('click', async () => {
        const userText = chatInput.value;
        if (!userText) return;
        addChatMessage(userText, "user");
        chatInput.value = "";
        
        const reply = await getChatResponse(userText, []); 
        addChatMessage(reply, "ai");
    });
    
    // 기타 이벤트 리스너들 (모달 등)
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
            showToast(`맞아! 거기에 있었네! 🎉`);
            currentGameObjects.splice(foundIndex, 1);
            updateMissionDisplay();
        }
    });
    
    chatInput.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); btnSendChat.click(); }});
    btnFinishReading.addEventListener('click', async () => { if (await showSystemModal("독서를 정말 마칠까요? 📚", "confirm")) { populateGallery(); showScreen('screen-gallery'); }});
    btnBackToStart.addEventListener('click', () => { resetApp(); showScreen('screen-welcome'); });
    btnGalleryPrev.addEventListener('click', () => showGallerySlide(currentSlideIndex - 1));
    btnGalleryNext.addEventListener('click', () => showGallerySlide(currentSlideIndex + 1));
    modalClose.addEventListener('click', closeFullscreenModal);
    fullscreenModal.addEventListener('click', (event) => { if (event.target === fullscreenModal) closeFullscreenModal(); });
    mainImage.addEventListener('click', () => openFullscreenModal(mainImage.src));
    gallerySlides.addEventListener('click', (event) => { if (event.target.tagName === 'IMG') openFullscreenModal(event.target.src); });


    // 🔽🔽🔽 실제 통신 API 함수 (간소화됨) 🔽🔽🔽

    /** [API 1] 책 표지 분석 (DB조회 포함 권장) */
    async function analyzeBookCover(file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch(`${API_BASE_URL}/api/analyze-cover`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Network error');
            // 기대 응답: { title: "...", characters: [...] }
            return await response.json();
        } catch (error) {
            console.error("API Error:", error);
            return null;
        }
    }

    /** [API 2] 페이지 처리 통합 (OCR+Prompt+Gen+Detect) */
    async function processBookPage(file, characters) {
        const formData = new FormData();
        formData.append('file', file);
        // 캐릭터 정보를 JSON 문자열로 변환하여 전송
        formData.append('characters', JSON.stringify(characters));

        try {
            const response = await fetch(`${API_BASE_URL}/api/process-page`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error('Processing failed');
            
            // 기대 응답: { ocrText, imageUrl, objects, aiQuestion }
            return await response.json(); 
        } catch (error) {
            console.error("API Error:", error);
            return null;
        }
    }

    /** [API 3] 채팅 */
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
            console.error(error);
            return "지금은 대답하기 어려워 😅";
        }
    }

    // 앱 시작
    showScreen('screen-welcome');
});