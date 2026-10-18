import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Camera, 
  Image as ImageIcon, 
  AlertCircle, 
  RefreshCw 
} from 'lucide-react';
import { PhotoCropEditorModal } from '../components/PhotoCropEditorModal';
import { catDraftStore } from '../utils/catDraftStore';
import { DEFAULT_PHOTO_CROP, type PhotoCropData } from '../utils/image';
import { getCurrentDeviceLocation, extractExifGps } from '../utils/geo';

export const AddCatCameraPage: React.FC = () => {
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [shutterFlashing, setShutterFlashing] = useState(false);

  // Capture & Crop Modal State
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [capturedLocation, setCapturedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // Stop all active camera tracks
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Safe ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start live camera stream
  const startCameraStream = useCallback(async () => {
    stopCameraStream();
    setIsInitializing(true);
    setCameraError(null);

    // Capture GPS fix in background around camera open time
    getCurrentDeviceLocation()
      .then((pos) => {
        setCapturedLocation({ latitude: pos.latitude, longitude: pos.longitude });
      })
      .catch(() => {
        // Safe ignore
      });

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setHasCameraPermission(false);
      setCameraError('Peramban Anda tidak mendukung akses kamera langsung. Silakan gunakan opsi unggah galeri.');
      setIsInitializing(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setHasCameraPermission(true);
      setCameraError(null);
    } catch (err: unknown) {
      setHasCameraPermission(false);
      const isDenied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      if (isDenied) {
        setCameraError('Izin akses kamera ditolak. Berikan izin kamera di pengaturan peramban atau gunakan foto dari galeri.');
      } else {
        setCameraError('Kamera tidak dapat diakses atau sedang digunakan oleh aplikasi lain. Silakan coba lagi atau pilih dari galeri.');
      }
    } finally {
      setIsInitializing(false);
    }
  }, [stopCameraStream]);

  const capturedPreviewUrlRef = useRef<string | null>(null);
  useEffect(() => {
    capturedPreviewUrlRef.current = capturedPreviewUrl;
  }, [capturedPreviewUrl]);

  // Start stream on mount, stop on unmount
  useEffect(() => {
    startCameraStream();

    return () => {
      stopCameraStream();
      if (capturedPreviewUrlRef.current && capturedPreviewUrlRef.current.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(capturedPreviewUrlRef.current);
        } catch {
          // Safe ignore
        }
      }
    };
  }, [startCameraStream, stopCameraStream]);

  // Capture photo from live video using guide-mapped canvas
  const handleShutterClick = async () => {
    const video = videoRef.current;
    const container = containerRef.current;
    const guide = guideRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Kamera belum siap. Harap tunggu beberapa saat.');
      return;
    }

    setIsCapturing(true);
    setShutterFlashing(true);
    setTimeout(() => setShutterFlashing(false), 160);

    try {
      const containerRect = container?.getBoundingClientRect() || { width: video.videoWidth, height: video.videoHeight, left: 0, top: 0 };
      const guideRect = guide?.getBoundingClientRect() || containerRect;

      // Calculate video aspect ratio scaling for object-fit: cover
      const scale = Math.max(
        containerRect.width / video.videoWidth,
        containerRect.height / video.videoHeight
      );

      const renderedWidth = video.videoWidth * scale;
      const renderedHeight = video.videoHeight * scale;
      const offsetX = (containerRect.width - renderedWidth) / 2;
      const offsetY = (containerRect.height - renderedHeight) / 2;

      // Map on-screen square guide coordinates to natural video pixels
      let srcX = (guideRect.left - containerRect.left - offsetX) / scale;
      let srcY = (guideRect.top - containerRect.top - offsetY) / scale;
      let srcW = guideRect.width / scale;
      let srcH = guideRect.height / scale;

      // Add a 10% breathing margin for post-capture crop panning/zoom, clamped to video bounds
      const marginX = srcW * 0.1;
      const marginY = srcH * 0.1;

      srcX = Math.max(0, srcX - marginX);
      srcY = Math.max(0, srcY - marginY);
      srcW = Math.min(video.videoWidth - srcX, srcW + marginX * 2);
      srcH = Math.min(video.videoHeight - srcY, srcH + marginY * 2);

      const canvas = document.createElement('canvas');
      const targetSize = Math.min(Math.round(Math.max(srcW, srcH)), 1600);
      canvas.width = targetSize;
      canvas.height = targetSize;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas rendering context not available.');
      }

      ctx.drawImage(
        video,
        srcX,
        srcY,
        srcW,
        srcH,
        0,
        0,
        targetSize,
        targetSize
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setCameraError('Gagal memproses hasil foto kamera.');
            setIsCapturing(false);
            return;
          }

          if (capturedPreviewUrl && capturedPreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(capturedPreviewUrl);
          }

          const url = URL.createObjectURL(blob);
          setCapturedBlob(blob);
          setCapturedPreviewUrl(url);
          setShowCropModal(true);
          setIsCapturing(false);
          // Pause video while crop modal is active
          stopCameraStream();
        },
        'image/jpeg',
        0.90
      );
    } catch {
      setCameraError('Terjadi kesalahan saat memotret.');
      setIsCapturing(false);
    }
  };

  // Handle fallback gallery selection
  const handleGalleryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setCameraError('Berkas harus berupa gambar foto (JPEG, PNG, dsb).');
      return;
    }

    try {
      // Extract EXIF GPS if present in original gallery photo
      const exifGps = await extractExifGps(file);
      if (exifGps) {
        setCapturedLocation(exifGps);
      }

      if (capturedPreviewUrl && capturedPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }

      const url = URL.createObjectURL(file);
      setCapturedBlob(file);
      setCapturedPreviewUrl(url);
      setShowCropModal(true);
      stopCameraStream();
    } catch {
      setCameraError('Gagal membaca berkas dari galeri.');
    }
  };

  // Retake photo: reset captured state and restart camera
  const handleRetake = () => {
    setShowCropModal(false);
    setCapturedBlob(null);
    if (capturedPreviewUrl && capturedPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(capturedPreviewUrl);
      setCapturedPreviewUrl(null);
    }
    startCameraStream();
  };

  // Confirm approved crop and transfer to Add Cat form
  const handleConfirmCrop = (crop: PhotoCropData) => {
    if (!capturedBlob) return;

    catDraftStore.setPhotoDraft({
      blob: capturedBlob,
      crop,
      timestamp: Date.now(),
      location: capturedLocation,
    });

    stopCameraStream();
    setShowCropModal(false);

    // Proceed to Add Cat Details Form
    navigate('/cats/new/form');
  };

  return (
    <div className="camera-capture-screen" id="add-cat-camera-screen">
      {/* Visual Shutter Flash */}
      {shutterFlashing && <div className="camera-shutter-flash" />}

      {/* Header Bar */}
      <div className="camera-top-bar">
        <button
          type="button"
          className="camera-top-btn"
          onClick={() => {
            stopCameraStream();
            navigate(-1);
          }}
          aria-label="Kembali"
          id="btn-camera-back"
        >
          <ArrowLeft size={18} />
          <span>Batal</span>
        </button>

        <h1 className="camera-title">Foto Kucing</h1>

        <button
          type="button"
          className="camera-top-btn"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Pilih dari Galeri"
          id="btn-camera-gallery-fallback"
        >
          <ImageIcon size={18} />
          <span>Galeri</span>
        </button>
      </div>

      {/* Camera Guidance Instruction */}
      <div className="camera-guidance-banner">
        <span>Posisikan kucing di dalam bingkai</span>
      </div>

      {/* Main Viewport Container */}
      <div ref={containerRef} className="camera-viewport-container">
        {/* Hidden Fallback Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleGalleryFileSelect}
          style={{ display: 'none' }}
          aria-hidden="true"
        />

        {hasCameraPermission === false || cameraError ? (
          <div className="camera-error-container">
            <div className="camera-error-card">
              <AlertCircle size={32} color="var(--color-danger)" />
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'bold', margin: '4px 0' }}>
                Kamera Tidak Tersedia
              </h2>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', margin: '0 0 16px 0' }}>
                {cameraError || 'Tidak dapat mengakses kamera perangkat Anda.'}
              </p>
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={startCameraStream}
                  style={{ flex: 1, padding: '10px', fontSize: 'var(--font-size-xs)' }}
                  id="btn-camera-retry"
                >
                  <RefreshCw size={14} />
                  <span>Coba Lagi</span>
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ flex: 1, padding: '10px', fontSize: 'var(--font-size-xs)' }}
                  id="btn-choose-from-gallery"
                >
                  <ImageIcon size={14} />
                  <span>Pilih dari Galeri</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Live Video */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="camera-live-video"
            />

            {/* Framing Guides Overlay */}
            <div className="camera-guides-overlay">
              {/* Outer Square Guide (Detail Profile 1:1) */}
              <div ref={guideRef} className="camera-square-guide">
                {/* 3x3 Composition Grid */}
                <div className="camera-guide-grid">
                  <div className="grid-cell" />
                  <div className="grid-cell" />
                  <div className="grid-cell" />
                  <div className="grid-cell" />
                  <div className="grid-cell" />
                  <div className="grid-cell" />
                  <div className="grid-cell" />
                  <div className="grid-cell" />
                  <div className="grid-cell" />
                </div>

                {/* Inner Circular Guide (Map Marker Circle) */}
                <div className="camera-circular-guide" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Guide Legend Info */}
      <div className="camera-legend-bar">
        <span className="legend-tag">Kotak: pratinjau profil</span>
        <span className="legend-divider">•</span>
        <span className="legend-tag">Lingkaran: penanda peta</span>
      </div>

      {/* Bottom Shutter Controls */}
      <div className="camera-bottom-bar">
        <button
          type="button"
          className="camera-side-action"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Pilih foto dari galeri"
        >
          <ImageIcon size={22} />
          <span>Galeri</span>
        </button>

        {/* Shutter Button */}
        <button
          type="button"
          className="camera-shutter-button"
          onClick={handleShutterClick}
          disabled={isInitializing || hasCameraPermission === false || isCapturing}
          aria-label="Ambil Foto Kucing"
          id="btn-take-photo"
        >
          <div className="shutter-inner-circle">
            <Camera size={26} color="#FFFFFF" />
          </div>
        </button>

        <button
          type="button"
          className="camera-side-action"
          onClick={startCameraStream}
          aria-label="Segarkan kamera"
          disabled={isInitializing}
        >
          <RefreshCw size={20} className={isInitializing ? 'spin' : ''} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* Mandatory Crop Adjustment Modal */}
      {showCropModal && capturedPreviewUrl && (
        <PhotoCropEditorModal
          imageUrl={capturedPreviewUrl}
          initialCrop={DEFAULT_PHOTO_CROP}
          saveButtonText="Gunakan Foto Ini"
          cancelButtonText="Foto Ulang"
          onSave={handleConfirmCrop}
          onClose={handleRetake}
        />
      )}
    </div>
  );
};
