import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Camera, 
  Image as ImageIcon, 
  AlertCircle, 
  RefreshCw,
  Star,
  X,
  Crop,
  ArrowRight
} from 'lucide-react';
import { CatPhotoImg } from '../components/CatPhotoImg';
import { PhotoCropEditorModal } from '../components/PhotoCropEditorModal';
import { catDraftStore, type AddCatPhotoDraft } from '../utils/catDraftStore';
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

  // Multi-Photo Capture State
  const [capturedPhotos, setCapturedPhotos] = useState<AddCatPhotoDraft[]>(() => {
    return catDraftStore.getPhotosDraft();
  });
  const [viewMode, setViewMode] = useState<'live' | 'gallery'>(() => {
    return catDraftStore.hasPhotoDraft() ? 'gallery' : 'live';
  });
  const [capturedLocation, setCapturedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // Keep track of object URLs created in this session for cleanup
  const sessionUrlsRef = useRef<Set<string>>(new Set());

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
      setCameraError('Peramban Anda tidak mendukung akses kamera langsung. Silakan gunakan opsi galeri.');
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
        setCameraError('Izin akses kamera ditolak. Berikan izin kamera di pengaturan peramban atau pilih foto dari galeri.');
      } else {
        setCameraError('Kamera tidak dapat diakses atau sedang digunakan oleh aplikasi lain. Silakan coba lagi atau pilih dari galeri.');
      }
    } finally {
      setIsInitializing(false);
    }
  }, [stopCameraStream]);

  // Start stream on mount, stop on unmount
  useEffect(() => {
    startCameraStream();

    return () => {
      stopCameraStream();
    };
  }, [startCameraStream, stopCameraStream]);

  // Capture photo from live video using guide-mapped canvas
  const handleShutterClick = async () => {
    // If user is previewing gallery and camera is active, switch to live camera view first
    if (viewMode === 'gallery' && hasCameraPermission && !cameraError) {
      setViewMode('live');
      return;
    }

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

          const url = URL.createObjectURL(blob);
          sessionUrlsRef.current.add(url);

          setCapturedPhotos((prev) => {
            const isFirst = prev.length === 0;
            const newPhoto: AddCatPhotoDraft = {
              id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              blob,
              previewUrl: url,
              isCover: isFirst, // First captured photo is default cover
              crop: { ...DEFAULT_PHOTO_CROP },
              timestamp: Date.now(),
              location: capturedLocation,
            };
            return [...prev, newPhoto];
          });

          setIsCapturing(false);
          setViewMode('live');
        },
        'image/jpeg',
        0.90
      );
    } catch {
      setCameraError('Terjadi kesalahan saat memotret.');
      setIsCapturing(false);
    }
  };

  // Handle gallery file selection (supports multi-selection)
  const handleGalleryFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputFiles = e.target.files;
    if (!inputFiles || inputFiles.length === 0) return;
    // Snapshot into Array BEFORE resetting value so files are not wiped out
    const fileList = Array.from(inputFiles);
    e.target.value = '';

    const newItems: AddCatPhotoDraft[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('image/')) continue;

      let fileLocation = capturedLocation;
      try {
        const exifGps = await extractExifGps(file);
        if (exifGps) {
          fileLocation = exifGps;
        }
      } catch {
        // Safe ignore
      }

      const url = URL.createObjectURL(file);
      sessionUrlsRef.current.add(url);

      newItems.push({
        id: `photo_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        blob: file,
        previewUrl: url,
        isCover: false, // will be resolved below
        crop: { ...DEFAULT_PHOTO_CROP },
        timestamp: Date.now() + i,
        location: fileLocation,
      });
    }

    if (newItems.length > 0) {
      setCapturedPhotos((prev) => {
        const hadCover = prev.some((p) => p.isCover);
        if (!hadCover) {
          newItems[0].isCover = true;
        }
        return [...prev, ...newItems];
      });

      setViewMode('gallery');
      // Automatically prompt crop editor for the cover photo
      setShowCropModal(true);
    }
  };

  // Select a photo as Cover
  const handleSelectCover = (id: string) => {
    setCapturedPhotos((prev) =>
      prev.map((photo) => ({
        ...photo,
        isCover: photo.id === id,
      }))
    );
    setViewMode('gallery');
  };

  // Delete a photo from captured queue
  const handleDeletePhoto = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCapturedPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl && target.previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(target.previewUrl);
        } catch {
          // Safe ignore
        }
        sessionUrlsRef.current.delete(target.previewUrl);
      }

      const next = prev.filter((p) => p.id !== id);
      if (next.length === 0) {
        if (hasCameraPermission && !cameraError) {
          setViewMode('live');
        }
        return next;
      }

      if (target?.isCover && next.length > 0) {
        next[0].isCover = true;
      }
      return next;
    });
  };

  // Current cover photo
  const currentCover = capturedPhotos.find((p) => p.isCover) || capturedPhotos[0] || null;

  // Open Crop Editor Modal: STRICTLY FOR COVER PHOTO ONLY
  const handleOpenCropModal = () => {
    if (!currentCover) return;
    setShowCropModal(true);
  };

  // Confirm approved crop for the cover photo
  const handleConfirmCoverCrop = (crop: PhotoCropData) => {
    if (!currentCover) return;

    setCapturedPhotos((prev) =>
      prev.map((photo) => {
        if (photo.id === currentCover.id) {
          return { ...photo, crop: { ...crop } };
        }
        return photo;
      })
    );

    setShowCropModal(false);
  };

  // Proceed to Add Cat Form with all captured photos
  const handleProceedToForm = () => {
    if (capturedPhotos.length === 0) return;

    // Save all photos to draft store
    catDraftStore.setPhotosDraft(capturedPhotos);
    stopCameraStream();
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
        <span>
          {capturedPhotos.length > 0 
            ? `${capturedPhotos.length} foto diambil • Ketuk bintang untuk jadikan sampul` 
            : 'Posisikan kucing di dalam bingkai • Bisa lebih dari 1 foto'}
        </span>
      </div>

      {/* Main Viewport Container */}
      <div ref={containerRef} className="camera-viewport-container">
        {/* Hidden Fallback Multi-File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          multiple
          onChange={handleGalleryFileSelect}
          style={{ display: 'none' }}
          aria-hidden="true"
        />

        {/* If we have a cover photo and we are either in gallery viewMode OR camera is unavailable/errored */}
        {currentCover && (viewMode === 'gallery' || hasCameraPermission === false || !!cameraError) ? (
          <div className="camera-gallery-preview-viewport">
            <div
              className="camera-preview-img-wrapper"
              onClick={handleOpenCropModal}
              title="Ketuk untuk atur tampilan sampul"
              id="camera-gallery-preview-box"
            >
              <CatPhotoImg
                src={currentCover.previewUrl}
                crop={currentCover.crop}
                alt="Foto Sampul Kucing"
                className="camera-gallery-cover-img"
              />
            </div>

            {/* Framing Guides Overlay on top of preview */}
            <div className="camera-guides-overlay" style={{ pointerEvents: 'none' }}>
              <div ref={guideRef} className="camera-square-guide">
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
                <div className="camera-circular-guide" />
              </div>
            </div>

            {/* Floating indicator: Tap to adjust crop */}
            <div className="camera-cover-pill-indicator">
              <Star size={11} fill="currentColor" />
              <span>Foto Sampul • Ketuk untuk atur</span>
            </div>
          </div>
        ) : hasCameraPermission === false || cameraError ? (
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

      {/* Guide Legend Bar */}
      <div className="camera-legend-bar">
        <span className="legend-tag">Kotak: pratinjau profil</span>
        <span className="legend-divider">•</span>
        <span className="legend-tag">Lingkaran: penanda peta</span>
      </div>

      {/* Filmstrip Queue: Shows thumbnails of all taken photos */}
      {capturedPhotos.length > 0 && (
        <div className="camera-filmstrip-bar" id="camera-filmstrip">
          <div className="camera-filmstrip-scroll">
            {capturedPhotos.map((photo, index) => {
              const isCover = photo.isCover;
              return (
                <div
                  key={photo.id}
                  className={`camera-filmstrip-item ${isCover ? 'is-cover' : ''}`}
                  onClick={() => handleSelectCover(photo.id)}
                  title={isCover ? 'Foto Sampul (Utama)' : 'Klik untuk jadikan Sampul'}
                >
                  <img src={photo.previewUrl} alt={`Foto ${index + 1}`} className="camera-filmstrip-thumb" />
                  
                  {/* Badge Sampul */}
                  {isCover ? (
                    <span className="camera-filmstrip-badge cover-active">
                      <Star size={9} fill="currentColor" />
                      <span>Sampul</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="camera-filmstrip-badge set-cover-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCover(photo.id);
                      }}
                      title="Jadikan foto sampul"
                    >
                      <span>Jadikan Sampul</span>
                    </button>
                  )}

                  {/* Delete Thumbnail Button */}
                  <button
                    type="button"
                    className="camera-filmstrip-del-btn"
                    onClick={(e) => handleDeletePhoto(e, photo.id)}
                    aria-label="Hapus foto ini"
                    title="Hapus foto"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Quick Actions for Filmstrip */}
          <div className="camera-filmstrip-actions">
            <button
              type="button"
              className="btn-secondary camera-action-pill"
              onClick={handleOpenCropModal}
              disabled={!currentCover}
              id="btn-crop-cover-photo"
              title="Atur tampilan hanya berlaku untuk foto yang dijadikan sampul"
            >
              <Crop size={13} style={{ color: 'var(--color-primary)' }} />
              <span>Atur Tampilan Sampul</span>
            </button>

            <button
              type="button"
              className="btn-primary camera-action-pill"
              onClick={handleProceedToForm}
              id="btn-proceed-to-form"
            >
              <span>Lanjut ({capturedPhotos.length})</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bottom Shutter Controls */}
      <div className="camera-bottom-bar">
        <button
          type="button"
          className="camera-side-action"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Pilih foto dari galeri"
          id="btn-bottom-gallery"
        >
          <ImageIcon size={22} />
          <span>+ Foto</span>
        </button>

        {/* Shutter Button (Allows continuous taking of multiple photos) */}
        <button
          type="button"
          className="camera-shutter-button"
          onClick={handleShutterClick}
          disabled={isInitializing || (hasCameraPermission === false && viewMode === 'live') || isCapturing}
          aria-label={viewMode === 'gallery' && hasCameraPermission ? "Buka Kamera Langsung" : "Ambil Foto Kucing"}
          id="btn-take-photo"
          title={viewMode === 'gallery' && hasCameraPermission ? "Buka Kamera Langsung" : "Ambil Foto"}
        >
          <div className="shutter-inner-circle">
            <Camera size={26} color="#FFFFFF" />
          </div>
        </button>

        <button
          type="button"
          className="camera-side-action"
          onClick={() => {
            setViewMode('live');
            startCameraStream();
          }}
          aria-label="Segarkan kamera"
          disabled={isInitializing}
          id="btn-refresh-camera"
        >
          <RefreshCw size={20} className={isInitializing ? 'spin' : ''} />
          <span>Kamera</span>
        </button>
      </div>

      {/* Crop Adjustment Modal - STRICTLY APPLIES ONLY TO COVER PHOTO */}
      {showCropModal && currentCover && (
        <PhotoCropEditorModal
          imageUrl={currentCover.previewUrl}
          initialCrop={currentCover.crop}
          saveButtonText="Gunakan Foto Ini"
          cancelButtonText="Batal"
          onSave={handleConfirmCoverCrop}
          onClose={() => setShowCropModal(false)}
        />
      )}
    </div>
  );
};
