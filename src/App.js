import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Download,
  RefreshCcw,
  Settings,
  Image as ImageIcon,
  CheckCircle,
  Palette,
  Wifi,
  Monitor,
  Loader2,
  ExternalLink,
  Trash2,
  X,
  Copy,
} from "lucide-react";

// --- นำเข้าไฟล์เสียงจากโฟลเดอร์ src ---
import shutterSoundFile from "./shutter.mp3";
import buttonSoundFile from "./button.wav";
import savedSoundFile from "./Saved.wav";
import countdownSoundFile from "./countdown.mp3";

export default function PhotoBoothApp() {
  // --- State Management ---
  const [status, setStatus] = useState("idle"); // idle, counting, capturing, processing, finished
  const [countdown, setCountdown] = useState(5);
  const [photos, setPhotos] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [flash, setFlash] = useState(false);

  // Upload & Result State
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [generatedBlob, setGeneratedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  // Customization & Presets State
  const [showSettings, setShowSettings] = useState(false);
  const [appBg, setAppBg] = useState(null);

  // --- PRESETS (ตั้งค่ารูปพื้นหลัง 5 แบบ จาก Google Drive) ---
  const [bgPresets, setBgPresets] = useState([
    "https://drive.google.com/uc?export=view&id=1eiP8GjPZ8UegvpfZu4kVO3X9SV8xkcqm", // ภาพที่ 1
    "https://drive.google.com/uc?export=view&id=1ofGMu7OKSCpmPRlSKAU9oLYIiWHqv-5V", // ภาพที่ 2
    "https://drive.google.com/uc?export=view&id=1bGO7GaUPvAhhu4_p2NOwggifCAvgNa_R", // ภาพที่ 3
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=640&q=80", // 4. Minimal
    "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=640&q=80", // 5. Offset
  ]);

  // ชื่อสไตล์การจัดวาง 5 แบบ
  const layoutNames = [
    "แบบคลาสสิก",
    "แบบซิกแซก",
    "แบบโพลารอยด์",
    "แบบเต็มกรอบ",
    "แบบเยื้องสลับ",
  ];

  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRefApp = useRef(null);
  const fileInputRefPresets = useRef([]);

  // --- Audio Ref ---
  const shutterSoundRef = useRef(new Audio(shutterSoundFile));
  const buttonSoundRef = useRef(new Audio(buttonSoundFile));
  const savedSoundRef = useRef(new Audio(savedSoundFile));
  const countdownSoundRef = useRef(new Audio(countdownSoundFile));

  // --- ฟังก์ชันหยุดเสียงทั้งหมดก่อนเล่นเสียงใหม่ ---
  const stopAllSounds = () => {
    const sounds = [
      shutterSoundRef.current,
      buttonSoundRef.current,
      savedSoundRef.current,
      countdownSoundRef.current,
    ];

    sounds.forEach((sound) => {
      if (sound && !sound.paused) {
        sound.pause();
        sound.currentTime = 0; // รีเซ็ตเวลาให้กลับไปเริ่มต้น
      }
    });
  };

  // --- AUTOMATIC STYLE & FONT INJECTION ---
  useEffect(() => {
    if (!document.getElementById("tailwind-cdn")) {
      const script = document.createElement("script");
      script.id = "tailwind-cdn";
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
    if (!document.getElementById("google-fonts")) {
      const link = document.createElement("link");
      link.id = "google-fonts";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600;800&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  // 1. Initial Setup
  useEffect(() => {
    getCameras();

    // Pre-load audio
    if (shutterSoundRef.current) {
      shutterSoundRef.current.volume = 1.0;
      shutterSoundRef.current.load();
    }
    if (buttonSoundRef.current) {
      buttonSoundRef.current.volume = 1.0;
      buttonSoundRef.current.load();
    }
    if (savedSoundRef.current) {
      savedSoundRef.current.volume = 1.0;
      savedSoundRef.current.load();
    }
    if (countdownSoundRef.current) {
      countdownSoundRef.current.volume = 1.0;
      countdownSoundRef.current.load();
    }

    return () => stopCamera();
  }, []);

  // 2. Camera Handling
  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error("Error listing devices:", err);
    }
  };

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      if (streamRef.current && streamRef.current.active) {
        if (videoRef.current) {
          videoRef.current.srcObject = streamRef.current;
        }
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error starting camera:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (selectedDeviceId) {
      stopCamera();
      startCamera();
    }
  }, [selectedDeviceId]);

  // เล่นเสียงเมื่อสถานะเปลี่ยนเป็น finished (ถ่ายเสร็จเรียบร้อย)
  useEffect(() => {
    if (status === "finished") {
      if (buttonSoundRef.current) {
        stopAllSounds();
        buttonSoundRef.current.currentTime = 0;
        buttonSoundRef.current
          .play()
          .catch((e) => console.log("Audio play error", e));
      }
    }
  }, [status]);

  // Re-attach camera stream when returning to camera views
  useEffect(() => {
    if (status === "idle" || status === "counting" || status === "capturing") {
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current
            .play()
            .catch((e) => console.log("Video play error", e));
        } else {
          startCamera();
        }
      }, 100);
    }
  }, [status]);

  // 3. Photo Logic
  const resetToHome = () => {
    setPhotos([]);
    setQrCodeUrl("");
    setGeneratedBlob(null);
    setPreviewUrl("");
    setCopySuccess(false);
    setStatus("idle");
    setCountdown(5);
  };

  const startSession = () => {
    setPhotos([]);
    setQrCodeUrl("");
    setGeneratedBlob(null);
    setPreviewUrl("");
    setCopySuccess(false);
    setStatus("counting");
    setCountdown(5);
  };

  // --- อัปเดตระบบการนับถอยหลัง ---
  useEffect(() => {
    let timer;
    if (status === "counting") {
      if (countdown > 1) {
        // เล่นเสียงติ๊ดๆ เฉพาะตอนนับเลข 5, 4, 3, 2
        if (countdownSoundRef.current) {
          stopAllSounds();
          countdownSoundRef.current.currentTime = 0;
          const playPromise = countdownSoundRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => console.log("Audio play error", e));
          }
        }
        timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      } else if (countdown === 1) {
        // เมื่อถึงเลข 1 ให้ทำการถ่ายรูปทันที (ใน capturePhoto จะเล่นเสียง shutter ให้เลย)
        timer = setTimeout(() => {
          capturePhoto();
        }, 50);
      }
    }
    return () => clearTimeout(timer);
  }, [status, countdown]);

  const capturePhoto = () => {
    // Play Shutter Sound ทันทีที่เข้าสู่โหมดจับภาพ
    if (shutterSoundRef.current) {
      stopAllSounds();
      shutterSoundRef.current.currentTime = 0;
      const playPromise = shutterSoundRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("Audio playback failed:", error);
        });
      }
    }

    setStatus("capturing");
    setFlash(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const context = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 1.0);

      const newPhotos = [...photos, dataUrl];
      setPhotos(newPhotos);

      // หน่วงเวลาให้แฟลชทำงานและเลข 1 ค้างไว้ที่หน้าจอแป๊บนึง ก่อนไปขั้นตอนถัดไป
      setTimeout(() => {
        setFlash(false);
        if (newPhotos.length < 3) {
          setCountdown(5);
          setStatus("counting");
        } else {
          processAndUpload(newPhotos);
        }
      }, 600); // ดีเลย์ 0.6 วินาที ให้การถ่ายภาพดูสมูทขึ้น
    } else {
      setFlash(false);
    }
  };

  // 4. Generate & Upload Logic (Using Freeimage.host API)
  const processAndUpload = async (finalPhotos) => {
    setStatus("processing");

    try {
      const blob = await generateStripBlob(finalPhotos);

      if (!blob) {
        alert(
          "ไม่สามารถสร้างรูปภาพได้เนื่องจากปัญหาความปลอดภัยของรูปพื้นหลัง (CORS) กรุณาลองอัปโหลดรูปพื้นหลังใหม่จากเครื่องของคุณ"
        );
        setStatus("finished");
        return;
      }

      const previewObjUrl = URL.createObjectURL(blob);
      setGeneratedBlob(blob);
      setPreviewUrl(previewObjUrl);

      // อัปโหลดเข้า Freeimage.host API (ฟรี โหลดได้หลายครั้ง)
      const formData = new FormData();
      formData.append("key", "6d207e02198a847aa98d0a2a901485a5"); // Public API Key ของ Freeimage.host
      formData.append("action", "upload");
      formData.append("source", blob, "dmd-booth-photo.jpg");
      formData.append("format", "json");

      fetch("https://freeimage.host/api/1/upload", {
        method: "POST",
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.status_code === 200) {
            // ได้รับ URL รูปภาพกลับมา
            setQrCodeUrl(data.image.url);
          } else {
            console.error("Cloud Upload Failed:", data);
          }
        })
        .catch((err) => {
          console.error("Network Error", err);
        })
        .finally(() => {
          setStatus("finished");
        });
    } catch (error) {
      console.error("Process Error:", error);
      setStatus("finished");
    }
  };

  const generateStripBlob = async (photosToUse) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const targetW = 1080;
    const targetH = 1920;
    canvas.width = targetW;
    canvas.height = targetH;

    const activeBg = bgPresets[selectedPresetIndex];

    if (activeBg) {
      const bgImg = new Image();
      bgImg.crossOrigin = "Anonymous";

      try {
        await new Promise((resolve, reject) => {
          bgImg.onload = resolve;
          bgImg.onerror = () => reject(new Error("Failed to load background"));
          bgImg.src = activeBg;
        });

        const scale = Math.max(targetW / bgImg.width, targetH / bgImg.height);
        const x = targetW / 2 - (bgImg.width / 2) * scale;
        const y = targetH / 2 - (bgImg.height / 2) * scale;
        ctx.drawImage(bgImg, x, y, bgImg.width * scale, bgImg.height * scale);
      } catch (e) {
        console.warn("Background image issue, using white background.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);
      }
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }

    const imgTemp = new Image();
    imgTemp.src = photosToUse[0];
    await new Promise((r) => (imgTemp.onload = r));
    const imgAspect = imgTemp.width / imgTemp.height;

    const paddingX = 80;
    const gapY = 40;
    const headerSpace = 250;
    const footerSpace = 150;

    // Base Calculation for Standard Vertical
    let photoW = targetW - paddingX * 2;
    let photoH = photoW / imgAspect;

    const totalContentHeight =
      headerSpace + footerSpace + photoH * 3 + gapY * 2;

    if (totalContentHeight > targetH) {
      const availableH = targetH - headerSpace - footerSpace - gapY * 2;
      photoH = availableH / 3;
      photoW = photoH * imgAspect;
    }

    const startX = (targetW - photoW) / 2;
    const startY =
      headerSpace +
      (targetH - headerSpace - footerSpace - (photoH * 3 + gapY * 2)) / 2;

    // Render Header
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (activeBg) {
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#333";
    }
    //ctx.font = "bold 80px Kanit, sans-serif";
    //ctx.fillText(" ", targetW / 2, headerSpace / 2 + 20);
    ///ctx.shadowBlur = 0;

    const border = 15;

    // --- DRAW PHOTOS BASED ON PRESET (5 STYLES) ---
    for (let i = 0; i < photosToUse.length; i++) {
      const photoUrl = photosToUse[i];
      const img = new Image();
      img.src = photoUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      ctx.save();

      if (selectedPresetIndex === 0) {
        // Style 1: ภาพตรง คลาสสิก
        const yPos = startY + i * (photoH + gapY);
        if (activeBg) {
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0,0,0,0.2)";
          ctx.shadowBlur = 15;
          ctx.fillRect(
            startX - border,
            yPos - border,
            photoW + border * 2,
            photoH + border * 2
          );
          ctx.shadowBlur = 0;
        }
        ctx.drawImage(img, startX, yPos, photoW, photoH);
      } else if (selectedPresetIndex === 1) {
        // Style 2: ซิกแซก สลับซ้ายขวา
        const scaleFactor = 0.85;
        const staggW = photoW * scaleFactor;
        const staggH = photoH * scaleFactor;

        const staggBlockHeight = staggH * 3 + gapY * 2;
        const staggStartY =
          headerSpace +
          (targetH - headerSpace - footerSpace - staggBlockHeight) / 2;

        const isLeft = i % 2 === 0;
        const shiftX = isLeft
          ? paddingX + 20
          : targetW - staggW - paddingX - 20;
        const yPos = staggStartY + i * (staggH + gapY);

        if (activeBg) {
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0,0,0,0.3)";
          ctx.shadowBlur = 20;
          ctx.fillRect(
            shiftX - border,
            yPos - border,
            staggW + border * 2,
            staggH + border * 2
          );
          ctx.shadowBlur = 0;
        }
        ctx.drawImage(img, shiftX, yPos, staggW, staggH);
      } else if (selectedPresetIndex === 2) {
        // Style 3: โพลารอยด์ วางเอียง ซ้อนทับกัน
        const scaleFactor = 0.8;
        const staggW = photoW * scaleFactor;
        const staggH = photoH * scaleFactor;

        const staggBlockHeight = staggH * 3 + gapY * 0.5;
        const staggStartY =
          headerSpace +
          (targetH - headerSpace - footerSpace - staggBlockHeight) / 2;

        const centerX = targetW / 2;
        const centerY = staggStartY + i * (staggH + gapY * 0.5) + staggH / 2;

        const angles = [-0.07, 0.05, -0.06];
        const offsetsX = [-40, 50, -30];

        ctx.translate(centerX + offsetsX[i], centerY);
        ctx.rotate(angles[i]);

        if (activeBg) {
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0,0,0,0.4)";
          ctx.shadowBlur = 25;
          ctx.fillRect(
            -staggW / 2 - border,
            -staggH / 2 - border,
            staggW + border * 2,
            staggH + border * 4
          );
          ctx.shadowBlur = 0;
        }
        ctx.drawImage(img, -staggW / 2, -staggH / 2, staggW, staggH);
      } else if (selectedPresetIndex === 3) {
        // Style 4: แบบเต็มกรอบ (Minimal Full)
        const scaleFactor = 1.1;
        const fullW = photoW * scaleFactor;
        const fullH = photoH * scaleFactor;

        const fullBlockH = fullH * 3 + gapY * 1.5;
        const fullStartY =
          headerSpace + (targetH - headerSpace - footerSpace - fullBlockH) / 2;

        const centerX = (targetW - fullW) / 2;
        const yPos = fullStartY + i * (fullH + gapY * 0.8);

        if (activeBg) {
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0,0,0,0.2)";
          ctx.shadowBlur = 10;
          ctx.fillRect(centerX - 10, yPos - 10, fullW + 20, fullH + 20);
          ctx.shadowBlur = 0;
        }
        ctx.drawImage(img, centerX, yPos, fullW, fullH);
      } else if (selectedPresetIndex === 4) {
        // Style 5: แบบเยื้องสลับ (Staggered/Offset)
        const scaleFactor = 0.8;
        const staggW = photoW * scaleFactor;
        const staggH = photoH * scaleFactor;

        const staggBlockHeight = staggH * 3 + gapY * 2;
        const staggStartY =
          headerSpace +
          (targetH - headerSpace - footerSpace - staggBlockHeight) / 2;

        const centerX = targetW / 2;
        const offsetX = i % 2 === 0 ? -150 : 150;
        const yPos = staggStartY + i * (staggH + gapY * 0.5);

        const angle = i % 2 === 0 ? -0.05 : 0.05;

        ctx.translate(centerX + offsetX, yPos + staggH / 2);
        ctx.rotate(angle);

        if (activeBg) {
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0,0,0,0.3)";
          ctx.shadowBlur = 20;
          ctx.fillRect(
            -staggW / 2 - border,
            -staggH / 2 - border,
            staggW + border * 2,
            staggH + border * 2
          );
          ctx.shadowBlur = 0;
        }
        ctx.drawImage(img, -staggW / 2, -staggH / 2, staggW, staggH);
      }

      ctx.restore();
    }

    // Render Footer
    ctx.font = "bold 40px Kanit, sans-serif";
    if (activeBg) {
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#ffffff";
    } else {
      ctx.fillStyle = "#666";
    }
    ctx.fillText(
      "DIGITAL GRAPHIC DEPARTMENT ",
      targetW / 2,
      targetH - footerSpace / 2
    );

    try {
      return await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas to Blob failed"));
          },
          "image/jpeg",
          0.95
        );
      });
    } catch (e) {
      console.error("Canvas Security Error (CORS):", e);
      return null;
    }
  };

  const downloadStrip = () => {
    if (!generatedBlob) return;

    // เล่นเสียง Saved เมื่อกดปุ่มดาวน์โหลด
    if (savedSoundRef.current) {
      stopAllSounds();
      savedSoundRef.current.currentTime = 0;
      savedSoundRef.current
        .play()
        .catch((e) => console.log("Audio play error", e));
    }

    const url = URL.createObjectURL(generatedBlob);
    const link = document.createElement("a");
    link.download = `DMD-BOOTH-${Date.now()}.jpg`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBgPresetUpload = (e, index) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newPresets = [...bgPresets];
        newPresets[index] = e.target.result;
        setBgPresets(newPresets);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAppBgUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setAppBg(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  // --- Helper Function: Layout Preview Icon ---
  const renderLayoutPreviewIcon = (index) => {
    const photoClass = "w-8 h-5 bg-gray-200 border border-gray-400 shadow-sm";

    if (index === 0) {
      return (
        <div className="flex flex-col gap-1 items-center justify-center h-full w-full opacity-80 pt-2">
          <div className={photoClass}></div>
          <div className={photoClass}></div>
          <div className={photoClass}></div>
        </div>
      );
    } else if (index === 1) {
      return (
        <div className="flex flex-col gap-1 justify-center h-full w-full opacity-80 px-2 pt-2">
          <div className={`${photoClass} self-start`}></div>
          <div className={`${photoClass} self-end`}></div>
          <div className={`${photoClass} self-start`}></div>
        </div>
      );
    } else if (index === 2) {
      return (
        <div className="relative h-full w-full flex items-center justify-center opacity-80 pt-2 overflow-hidden">
          <div
            className={`${photoClass} absolute top-4 left-4 -rotate-6 z-10 bg-white p-0.5 box-content`}
          >
            <div className="w-full h-full bg-gray-200"></div>
          </div>
          <div
            className={`${photoClass} absolute top-10 right-4 rotate-6 z-20 bg-white p-0.5 box-content`}
          >
            <div className="w-full h-full bg-gray-200"></div>
          </div>
          <div
            className={`${photoClass} absolute bottom-4 left-6 -rotate-3 z-30 bg-white p-0.5 box-content`}
          >
            <div className="w-full h-full bg-gray-200"></div>
          </div>
        </div>
      );
    } else if (index === 3) {
      return (
        <div className="flex flex-col gap-0.5 items-center justify-center h-full w-full opacity-80 pt-2 px-3">
          <div className="w-full h-5 bg-gray-200 border border-gray-400 shadow-sm"></div>
          <div className="w-full h-5 bg-gray-200 border border-gray-400 shadow-sm"></div>
          <div className="w-full h-5 bg-gray-200 border border-gray-400 shadow-sm"></div>
        </div>
      );
    } else {
      return (
        <div className="relative h-full w-full flex flex-col items-center justify-center gap-1 opacity-80 pt-2">
          <div className="w-8 h-5 bg-gray-200 border border-gray-400 shadow-sm -ml-4 -rotate-2"></div>
          <div className="w-8 h-5 bg-gray-200 border border-gray-400 shadow-sm -mr-4 rotate-2"></div>
          <div className="w-8 h-5 bg-gray-200 border border-gray-400 shadow-sm -ml-4 -rotate-2"></div>
        </div>
      );
    }
  };

  return (
    <div
      className="min-h-screen font-sans selection:bg-pink-500 transition-all duration-500 bg-cover bg-center bg-no-repeat bg-gray-900 text-white flex flex-col items-center justify-center"
      style={{
        fontFamily: "'Kanit', sans-serif",
        backgroundImage: appBg ? `url(${appBg})` : "none",
      }}
    >
      {appBg && (
        <div className="absolute inset-0 bg-black/50 pointer-events-none" />
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* --- HEADER --- */}
      <header className="absolute top-0 left-0 right-0 p-4 bg-gray-900/90 backdrop-blur-md shadow-lg flex justify-between items-center z-40 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Camera className="text-pink-500" size={28} />
          <h1 className="text-xl font-bold tracking-wider text-white">
            DMD BOOTH PRO{" "}
            <span className="text-pink-500 text-sm font-normal">
              DIGITAL GRAPHIC DEPARTMENT
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full transition ${
              showSettings
                ? "bg-pink-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
            title="ตั้งค่า / อัปโหลดรูป"
          >
            <Palette size={20} />
          </button>
          <div className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1 border border-gray-600">
            <Settings size={16} className="text-gray-400" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-transparent text-white text-sm outline-none w-24 md:w-auto"
              disabled={status !== "idle"}
            >
              {devices.map((device) => (
                <option
                  key={device.deviceId}
                  value={device.deviceId}
                  className="bg-gray-800 text-white"
                >
                  {device.label || `Camera ${device.deviceId.slice(0, 5)}...`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* --- SETTINGS MODAL --- */}
      {showSettings && (
        <div className="absolute top-16 left-0 right-0 z-50 bg-gray-800/95 backdrop-blur-md border-b border-gray-700 p-6 animate-in slide-in-from-top-2 shadow-2xl">
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2 text-pink-400">
                <Settings size={24} /> ตั้งค่าระบบ
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition"
              >
                <X size={18} /> ปิดหน้าต่าง
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4 p-4 bg-gray-700/50 rounded-xl border border-gray-600">
                <label className="text-white font-medium flex items-center gap-2">
                  <Monitor size={18} /> Wallpaper หน้าจอโปรแกรม
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRefApp.current.click()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded text-sm transition"
                  >
                    อัปโหลด Wallpaper
                  </button>
                  {appBg && (
                    <button
                      onClick={() => setAppBg(null)}
                      className="bg-red-500 hover:bg-red-600 text-white p-2 rounded"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRefApp}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAppBgUpload}
                />
              </div>

              <div className="space-y-4 p-4 bg-gray-700/50 rounded-xl border border-gray-600">
                <label className="text-white font-medium flex items-center gap-2">
                  <ImageIcon size={18} /> รูปกรอบ/พื้นหลัง 5 แบบ
                  (คลิกเพื่อเปลี่ยน)
                </label>
                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <div key={idx} className="relative group">
                      <div
                        className="h-24 bg-gray-800 rounded-lg border-2 border-dashed border-gray-500 flex items-center justify-center overflow-hidden cursor-pointer hover:border-pink-500 transition relative"
                        onClick={() => {
                          if (!fileInputRefPresets.current[idx]) {
                            return;
                          }
                          fileInputRefPresets.current[idx].click();
                        }}
                      >
                        {bgPresets[idx] ? (
                          <img
                            src={bgPresets[idx]}
                            className="w-full h-full object-cover"
                            alt={`Preset ${idx + 1}`}
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs text-center">
                            แบบที่ {idx + 1}
                            <br />
                            (ว่าง)
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                          <span className="text-white text-xs font-bold">
                            เปลี่ยนรูป
                          </span>
                        </div>
                      </div>
                      {bgPresets[idx] && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newPresets = [...bgPresets];
                            newPresets[idx] = null;
                            setBgPresets(newPresets);
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition z-10"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      {/* Create Input for each preset */}
                      <input
                        type="file"
                        ref={(el) => (fileInputRefPresets.current[idx] = el)}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => handleBgPresetUpload(e, idx)}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  * ค่าเริ่มต้นจาก Google Drive (อัปโหลดใหม่ทับได้)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MAIN CONTENT --- */}
      <main className="relative z-10 flex flex-col items-center justify-center w-full h-full p-4 overflow-hidden pt-20">
        {flash && (
          <div className="absolute inset-0 bg-white z-50 animate-flash pointer-events-none z-50"></div>
        )}

        {/* --- STATE 1: IDLE / SELECTION / COUNTDOWN --- */}
        {(status === "idle" ||
          status === "counting" ||
          status === "capturing") && (
          <div className="w-full max-w-5xl flex flex-col gap-4 animate-in fade-in zoom-in duration-500">
            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-800/50 backdrop-blur-sm">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />

              {status === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="bg-gray-900/80 p-8 rounded-3xl border border-white/10 text-center shadow-2xl backdrop-blur-md">
                    <h2 className="text-5xl font-bold mb-4 text-white drop-shadow-lg">
                      พร้อมไหม?
                    </h2>
                    <p className="text-gray-300 mb-8 text-lg">
                      ถ่าย 3 แอคชั่น • เว้นช่วง 5 วินาที
                    </p>

                    <button
                      onClick={startSession}
                      className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-5 px-12 rounded-full text-2xl shadow-lg transform transition hover:scale-105 active:scale-95 flex items-center gap-3 mx-auto"
                    >
                      <Camera size={32} /> เริ่มถ่ายรูป
                    </button>
                  </div>
                </div>
              )}

              {/* แสดงตัวเลขนับถอยหลัง โดยเมื่อถ่ายรูป (capturing) จะโชว์เลข 1 ค้างไว้แป๊บนึง */}
              {(status === "counting" || status === "capturing") && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                  <div className="animate-pulse text-center">
                    <p className="text-3xl font-bold text-white mb-2 drop-shadow-md">
                      ภาพที่{" "}
                      {status === "capturing"
                        ? photos.length
                        : photos.length + 1}{" "}
                      / 3
                    </p>
                    <div className="text-[12rem] font-black text-white leading-none drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] stroke-black">
                      {status === "capturing" ? 1 : countdown}
                    </div>
                  </div>
                </div>
              )}

              {photos.length > 0 && (
                <div className="absolute right-4 top-4 w-32 flex flex-col gap-3 z-10">
                  {photos.map((p, i) => (
                    <img
                      key={i}
                      src={p}
                      className="w-full rounded border-2 border-white shadow-md transform scale-x-[-1]"
                      alt="preview"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* --- BACKGROUND & LAYOUT SELECTOR BAR --- */}
            {status === "idle" && (
              <div className="bg-gray-900/80 backdrop-blur-md p-4 rounded-2xl border border-gray-700 shadow-xl overflow-x-auto">
                <div className="text-center text-gray-300 text-sm mb-3 font-semibold uppercase tracking-widest">
                  เลือกสไตล์และพื้นหลัง
                </div>
                <div className="flex justify-center gap-4 min-w-max px-4">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPresetIndex(idx)}
                      className={`
                                    relative w-28 h-36 rounded-lg overflow-hidden border-4 transition-all duration-300 transform hover:scale-105 flex flex-col shrink-0
                                    ${
                                      selectedPresetIndex === idx
                                        ? "border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.7)] scale-105"
                                        : "border-gray-600 opacity-70 hover:opacity-100"
                                    }
                                `}
                    >
                      {/* รูป Preview + Layout Overlay */}
                      <div className="flex-1 w-full bg-gray-800 relative">
                        {/* พื้นหลัง */}
                        {bgPresets[idx] ? (
                          <img
                            src={bgPresets[idx]}
                            className="w-full h-full object-cover opacity-60"
                            alt={`Frame ${idx + 1}`}
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                            (ว่าง)
                          </div>
                        )}
                        {/* Overlay Layout Icon */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          {renderLayoutPreviewIcon(idx)}
                        </div>
                      </div>
                      {/* แถบชื่อ Layout ด้านล่าง */}
                      <div
                        className={`py-1.5 text-xs font-bold text-center w-full z-10
                                    ${
                                      selectedPresetIndex === idx
                                        ? "bg-pink-500 text-white"
                                        : "bg-gray-800 text-gray-300"
                                    }`}
                      >
                        {layoutNames[idx]}
                      </div>

                      {selectedPresetIndex === idx && (
                        <div className="absolute top-1 right-1 bg-pink-500 text-white p-0.5 rounded-full shadow-md z-20">
                          <CheckCircle size={14} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- STATE 2: PROCESSING (BLOCKING WAIT) --- */}
        {status === "processing" && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gray-900/95 backdrop-blur-lg animate-in fade-in">
            <Loader2 size={100} className="text-pink-500 mb-8 animate-spin" />
            <h2 className="text-4xl font-bold mb-4 text-white">
              กำลังสร้างรูปลิงก์ QR...
            </h2>
            <p className="text-gray-300 text-lg">
              กรุณารอสักครู่ ห้ามปิดหน้าต่าง
            </p>
            <p className="text-gray-500 text-sm mt-4">Uploading to Cloud...</p>
          </div>
        )}

        {/* --- STATE 3: FINISHED --- */}
        {status === "finished" && (
          <div className="flex flex-col lg:flex-row gap-8 items-center justify-center w-full max-w-6xl animate-fade-in h-full p-4">
            {/* Result Preview */}
            <div className="relative h-[70vh] aspect-[9/16] rounded-xl shadow-2xl overflow-hidden border-4 border-gray-800 bg-gray-900">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  className="w-full h-full object-contain"
                  alt="Strip Preview"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white">
                  Loading Preview...
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex-1 space-y-6 max-w-md w-full">
              <div className="bg-gray-900/90 backdrop-blur p-8 rounded-3xl border border-gray-700 shadow-2xl text-white text-center">
                <div className="flex items-center justify-center gap-3 mb-6 text-green-400">
                  <CheckCircle size={32} />
                  <h3 className="text-2xl font-bold">ถ่ายเสร็จเรียบร้อย!</h3>
                </div>

                {/* QR Code */}
                <div className="flex justify-center mb-6">
                  <div className="bg-white p-4 rounded-2xl shadow-inner relative min-h-[200px] min-w-[200px] flex items-center justify-center flex-col">
                    {qrCodeUrl ? (
                      <>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                            qrCodeUrl
                          )}`}
                          alt="Download QR Code"
                          className="w-48 h-48 mix-blend-multiply"
                        />
                        <p className="text-black text-xs mt-2 font-bold tracking-wide">
                          สแกนเพื่อรับรูป
                        </p>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Wifi size={40} className="mb-2 text-red-400" />
                        <span className="text-xs text-center px-2">
                          ดำเนินการถ่ายภาพเสร็จสิ้น
                          <br />
                          โปรดกดปุ่มบันทึกภาพด้านล่างครับ
                          <br />
                          เมื่อบันทึกเรียบร้อยแล้ว
                          <br />
                          โปรด Scan QR Code เพื่อรับรูปภาพ
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {qrCodeUrl && (
                  <div className="bg-gray-800 p-3 rounded-lg mb-6 border border-gray-700 flex flex-col gap-2">
                    <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                      <ExternalLink size={12} /> ลิงก์รูปภาพ (โหลดได้หลายครั้ง):
                    </p>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(qrCodeUrl);
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }}
                      className={`text-xs px-3 py-2 rounded flex items-center justify-center gap-2 transition ${
                        copySuccess
                          ? "bg-green-600 text-white"
                          : "bg-gray-700 text-pink-400 hover:bg-gray-600"
                      }`}
                    >
                      {copySuccess ? (
                        <CheckCircle size={14} />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copySuccess ? "คัดลอกแล้ว!" : "คัดลอกลิงก์ (Copy Link)"}
                    </button>
                  </div>
                )}

                <button
                  onClick={downloadStrip}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white py-4 px-6 rounded-xl flex items-center justify-center gap-3 mb-3 transition shadow-lg transform active:scale-95 group"
                >
                  <Download size={24} className="group-hover:animate-bounce" />
                  <span className="font-bold text-lg">บันทึกรูปภาพ (HD)</span>
                </button>
              </div>

              <div className="bg-gray-900/90 backdrop-blur p-6 rounded-2xl border border-gray-700 shadow-xl text-white">
                <button
                  onClick={resetToHome}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-4 rounded-xl shadow-lg transform active:scale-95 transition flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={20} /> เริ่มถ่ายใหม่
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes flash { 0% { opacity: 1; } 100% { opacity: 0; } }
        .animate-flash { animation: flash 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
}
