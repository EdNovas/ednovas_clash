const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
    // 1. 定义路径
    const rootDir = path.resolve(__dirname, '..');
    const jpgPath = path.join(rootDir, 'public/ezv9d7ezv9d7ezv9.jpg');
    const pngPath = path.join(rootDir, 'public/icon.png');
    const icoPath = path.join(rootDir, 'public/icon.ico'); // Windows 需要 ico

    console.log(`Converting ${jpgPath}...`);

    // 2. 加载图片
    const image = nativeImage.createFromPath(jpgPath);
    if (image.isEmpty()) {
        console.error('❌ Failed to load image. using default?');
        app.quit();
        return;
    }

    // 3. 转换为 PNG (512x512 is best for Linux)
    // resize usually not needed if source is high res, but let's ensure it works.
    // nativeImage loads it as is.
    const pngBuffer = image.toPNG();
    fs.writeFileSync(pngPath, pngBuffer);
    console.log(`✅ Created PNG: ${pngPath}`);

    // 4. (Optional) 尝试生成简单的 ICO (Electron 本身不直接转 ICO，但 Windows build 有时可以直接用 png)
    // 这里的关键是 Linux 报错，所以解决 PNG 是首要的。
    // Electron builder 实际上可以用 png 自动生成 win ico，所以只生成 PNG 即可。

    app.quit();
});
