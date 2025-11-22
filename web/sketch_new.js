// the link to your model provided by Teachable Machine export panel
const URL = "./my_model/";

let model, webcam, labelContainer, maxPredictions, port, writer;
let isRecognizing = false;
let countdownInterval = null;
let recognitionResult = null;
let loopId = null;
let recognitionCounts = { '1': 0, '0': 0 }; // 인식 결과 카운트

// Load the image model and setup the webcam
async function init() {
    try {
        // Start 버튼 비활성화, Stop 버튼 활성화
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
        // 버튼들 초기화
        document.getElementById('class1Btn').disabled = true;
        document.getElementById('class2Btn').disabled = true;
        const countdownDisplay = document.getElementById('countdownDisplay');
        countdownDisplay.textContent = '';
        countdownDisplay.classList.add('show');
        
        const modelURL = URL + "model.json";
        const metadataURL = URL + "metadata.json";

        // load the model and metadata
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        // Convenience function to setup a webcam
        const flip = true; // whether to flip the webcam
        webcam = new tmImage.Webcam(200, 200, flip); // width, height, flip
        await webcam.setup(); // request access to the webcam
        await webcam.play();

        // append elements to the DOM (중복 추가 방지)
        const webcamContainer = document.getElementById("webcam-container");
        if (webcamContainer.children.length === 0) {
            webcamContainer.appendChild(webcam.canvas);
        }
        
        labelContainer = document.getElementById("label-container");
        if (labelContainer.children.length === 0) {
            for (let i = 0; i < maxPredictions; i++) { // and class labels
                labelContainer.appendChild(document.createElement("div"));
            }
        }

        // 시리얼 포트 요청 (선택사항 - 실패해도 계속 진행)
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            writer = port.writable.getWriter();
        } catch (error) {
            console.warn('시리얼 포트 연결 실패 (계속 진행):', error);
            // 시리얼 포트 없이도 진행 가능하도록
        }
        
        // 10초 카운트다운 시작
        startCountdown();
    } catch (error) {
        console.error('초기화 오류:', error);
        alert('초기화 중 오류가 발생했습니다: ' + error.message);
        document.getElementById('startBtn').disabled = false;
    }
}

// 10초 카운트다운 시작
function startCountdown() {
    // 이전 카운트다운이 있으면 정리
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    let countdown = 10;
    const countdownDisplay = document.getElementById('countdownDisplay');
    isRecognizing = true;
    recognitionResult = null;
    recognitionCounts = { '1': 0, '0': 0 }; // 인식 결과 카운트 초기화
    
    // 카운트다운 표시 영역 확실히 보이도록 설정
    countdownDisplay.classList.add('show');
    countdownDisplay.textContent = countdown;
    
    // 카운트다운 업데이트
    countdownInterval = setInterval(() => {
        countdown--;
        if (countdownDisplay) {
            countdownDisplay.textContent = countdown;
        }
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            if (countdownDisplay) {
                countdownDisplay.textContent = '인식 완료!';
            }
            setTimeout(() => {
                stopRecognition();
            }, 500);
        }
    }, 1000);
    
    // 인식 루프 시작
    loop();
}

async function loop() {
    if (!isRecognizing) {
        return;
    }
    
    webcam.update(); // update the webcam frame
    await predict();
    
    if (isRecognizing) {
        loopId = window.requestAnimationFrame(loop);
    }
}

// run the webcam image through the image model
async function predict() {
    if (!isRecognizing) {
        return;
    }
    
    // predict can take in an image, video or canvas html element
    const prediction = await model.predict(webcam.canvas);
    for (let i = 0; i < maxPredictions; i++) {
        const classPrediction =
            prediction[i].className + ": " + prediction[i].probability.toFixed(2);
        labelContainer.childNodes[i].innerHTML = classPrediction;
    }

    // 얼굴 인식 결과 카운트 (10초 동안 누적)
    if (prediction[0].probability > 0.5) {
        recognitionCounts['1']++;
        sendSignalToArduino('1');
    } else {
        recognitionCounts['0']++;
        sendSignalToArduino('0');
    }
}

// 인식 중지 및 결과 처리
function stopRecognition() {
    isRecognizing = false;
    
    if (loopId) {
        cancelAnimationFrame(loopId);
        loopId = null;
    }
    
    // 웹캠 중지
    if (webcam) {
        webcam.stop();
    }
    
    // 10초 동안 누적된 결과를 바탕으로 최종 결과 결정
    if (recognitionCounts['1'] > recognitionCounts['0']) {
        recognitionResult = '1';
    } else if (recognitionCounts['0'] > recognitionCounts['1']) {
        recognitionResult = '0';
    } else {
        // 동점인 경우 마지막 결과 사용
        recognitionResult = recognitionCounts['1'] >= recognitionCounts['0'] ? '1' : '0';
    }
    
    // 결과에 따라 버튼 활성화
    setTimeout(() => {
        const countdownDisplay = document.getElementById('countdownDisplay');
        if (recognitionResult === '1') {
            document.getElementById('class1Btn').disabled = false;
            countdownDisplay.textContent = '';
            countdownDisplay.classList.remove('show');
        } else if (recognitionResult === '0') {
            document.getElementById('class2Btn').disabled = false;
            countdownDisplay.textContent = '';
            countdownDisplay.classList.remove('show');
        } else {
            // 결과가 없으면 카운트다운 숨김
            countdownDisplay.textContent = '';
            countdownDisplay.classList.remove('show');
        }
        
        // Start 버튼 다시 활성화, Stop 버튼 비활성화
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
    }, 500);
}

// 강제 종료 함수
function forceStop() {
    // 카운트다운 정리
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    // 인식 중지
    stopRecognition();
}

// 시리얼 통신을 통해 아두이노에 신호를 보냅니다.
async function sendSignalToArduino(signal) {
    if (writer) {
        try {
            await writer.write(new TextEncoder().encode(signal));
        } catch (error) {
            console.error('아두이노 전송 오류:', error);
        }
    }
}

// 프로필 모달을 띄우는 함수 (index.html에서 호출)
function openProfileModal(profilePath) {
    const modal = document.getElementById('profileModal');
    const iframe = document.getElementById('profileIframe');
    
    iframe.src = profilePath;
    modal.style.display = 'flex';
}

// 모달을 닫는 함수
function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    modal.style.display = 'none';
}
