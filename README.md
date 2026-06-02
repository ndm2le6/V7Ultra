# Rin-NDM V7 Ultra Official Heavy Game Source

Đây là bản source chính thức hướng **game pet + học tập + AI** nặng hơn bản demo HTML cũ.

## Tính năng chính

- Đồ họa 3D procedural bằng Three.js: pet, cây Sakura, nền cỏ.
- Chỉ còn 2 tiền tệ: Vàng và Kim cương.
- Level người chơi 1-1000, công thức tăng chậm.
- Pet companion: no, khát, vui, sạch, khỏe, năng lượng, ngủ theo giờ thật.
- Cây Sakura: tăng trưởng, thiếu nước/dinh dưỡng, héo/chết/hồi sinh, ra quả đào.
- Shop: Pet / Cây / Trang trí.
- Study Academy: note học tập và Toán lớp 1-12 dạng module dữ liệu.
- Mini game học tập: Quiz Boss, Flashcard Battle, Fitness Quest, Math Sprint.
- AI Nohara Rin dùng Gemini API do người dùng nhập trong app.
- Voice: bấm mic để nói nếu Android WebView hỗ trợ SpeechRecognition; đọc câu trả lời bằng speechSynthesis.
- GitHub Actions build APK tự động.

## Cách build APK bằng GitHub

1. Tạo repository mới.
2. Upload toàn bộ file trong zip này lên repo.
3. Vào tab Actions.
4. Chạy workflow `Build Android APK`.
5. Tải artifact `Rin-NDM-V7-Ultra-debug-apk`.
6. Giải nén artifact sẽ có `app-debug.apk`.

## Lưu ý thật

- Đây là bản game web/Capacitor + Three.js, không phải Unity/Godot.
- Đã nặng và nghiêm túc hơn mockup cũ, nhưng model pet/cây là procedural 3D tự tạo, không dùng asset bản quyền.
- Muốn đồ họa ngang game thương mại thật 100% thì bước sau cần thay procedural pet/cây bằng model `.glb` chuyên nghiệp hoặc chuyển Unity/Godot.
- Không nhúng API key vào source để tránh lộ key.


## Audit sau rà soát

- Đã chạy `node --check src/main.js`: PASS.
- Đã chạy `npm install`: PASS.
- Đã chạy `npm audit --audit-level=high`: PASS, 0 vulnerabilities sau khi nâng Capacitor lên 8.3.4.
- Đã chạy `npm run build`: PASS.
- Đã chạy `npx cap add android`: PASS.
- Đã chạy `npx cap sync android`: PASS.
- Build Gradle local trong môi trường ChatGPT bị chặn tải `services.gradle.org`, nên chưa build APK local được tại đây; GitHub Actions có internet nên sẽ tải Gradle và build APK bình thường.
