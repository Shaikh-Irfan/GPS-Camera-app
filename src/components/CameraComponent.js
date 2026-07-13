"use client";

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Mountain, AlertCircle, Camera } from 'lucide-react';
import html2canvas from 'html2canvas';

export default function CameraComponent() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const [hasStarted, setHasStarted] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [error, setError] = useState(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('Fetching address...');
  const [heading, setHeading] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (!hasStarted) return;

    let watchId;
    let cleanupCompass;

    async function setupCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not available. This usually happens if you open the link in a social media app (like Instagram) instead of a real browser like Chrome/Safari.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermissions(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        const errMsg = err.message || 'Permission denied';
        setError(`Camera Error: ${errMsg}. Please check browser settings.`);
        setStatus('error');
        alert(`Camera Error: ${errMsg}`); // Fallback alert in case UI fails
      }
    }

    function setupLocation() {
      if (!navigator.geolocation) {
        setError("Geolocation not supported by your browser.");
        setStatus('error');
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const alt = position.coords.altitude || 0;
          
          setLocation({ lat, lng, alt });
          updateMap(lat, lng);
          
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await res.json();
            if (data && data.display_name) {
              const parts = data.display_name.split(',');
              setAddress(parts.slice(0, 3).join(','));
              setStatus('ready');
            }
          } catch (e) {
            console.error("Geocoding error", e);
          }
        },
        (err) => {
          console.error("Location error:", err);
          setError(`Location Error: ${err.message}`);
          setStatus('error');
        },
        // Timeout prevents indefinite hanging on mobile if GPS signal is weak
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 } 
      );
    }

    function setupCompass() {
      const handleOrientation = (event) => {
        let h = event.webkitCompassHeading;
        if (!h && event.alpha !== null) {
          h = 360 - event.alpha;
        }
        if (h) setHeading(Math.round(h));
      };

      if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation);
        return () => window.removeEventListener('deviceorientation', handleOrientation);
      }
      return null;
    }

    setupCamera();
    setupLocation();
    cleanupCompass = setupCompass();

    return () => {
      if (cleanupCompass) cleanupCompass();
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [hasStarted]);

  const updateMap = async (lat, lng) => {
    const L = (await import('leaflet')).default;
    
    if (!mapInstanceRef.current && mapContainerRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false
      }).setView([lat, lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstanceRef.current);
      
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: "<div style='background-color:#FF3B30;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);'></div>",
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([lat, lng], { icon: customIcon }).addTo(mapInstanceRef.current);
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 15);
    }
  };

  const capturePhoto = async () => {
    if (!hasPermissions || !location) return;

    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 500);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const scale = canvas.width / window.innerWidth;
    const padding = 20 * scale;
    const boxBottomY = canvas.height - 40 * scale;
    
    let mapImage = null;
    if (mapContainerRef.current) {
      const mapCanvas = await html2canvas(mapContainerRef.current, { useCORS: true });
      mapImage = mapCanvas;
    }

    const boxHeight = 120 * scale;
    const boxWidth = canvas.width - (padding * 2);
    const boxY = boxBottomY - boxHeight;
    const boxX = padding;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 16 * scale);
    ctx.fill();

    const mapSize = 90 * scale;
    const mapX = boxX + 15 * scale;
    const mapY = boxY + 15 * scale;
    
    if (mapImage) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(mapX, mapY, mapSize, mapSize, 8 * scale);
      ctx.clip();
      ctx.drawImage(mapImage, mapX, mapY, mapSize, mapSize);
      ctx.restore();
    } else {
      ctx.fillStyle = '#333';
      ctx.roundRect(mapX, mapY, mapSize, mapSize, 8 * scale);
      ctx.fill();
    }

    const textX = mapX + mapSize + 15 * scale;
    let textY = mapY + 25 * scale;
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${18 * scale}px sans-serif`;
    ctx.fillText(address.length > 35 ? address.substring(0, 35) + '...' : address, textX, textY);
    
    textY += 30 * scale;
    ctx.font = `${14 * scale}px monospace`;
    ctx.fillStyle = '#d1d5db';
    ctx.fillText(`Lat: ${location.lat.toFixed(6)} | Lng: ${location.lng.toFixed(6)}`, textX, textY);
    
    textY += 25 * scale;
    ctx.font = `${12 * scale}px sans-serif`;
    ctx.fillStyle = '#9ca3af';
    
    const dateStr = new Date().toLocaleString();
    const headingStr = heading !== null ? ` | ${heading}°` : '';
    const altStr = ` | ${(location.alt).toFixed(1)}m`;
    
    ctx.fillText(`${dateStr}${headingStr}${altStr}`, textX, textY);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `GPS_Photo_${Date.now()}.jpg`;
    link.click();
  };

  const getDirection = (deg) => {
    if (deg === null) return '';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  };

  if (!hasStarted) {
    return (
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#000', color: 'white', padding: '20px', textAlign: 'center', zIndex: 1000 }}>
        <Camera size={64} color="#FF3B30" style={{ marginBottom: '20px' }} />
        <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>GPS Map Camera</h1>
        <p style={{ color: '#aaa', marginBottom: '40px', maxWidth: '300px' }}>
          This app requires access to your camera and location to stamp GPS data onto your photos.
        </p>
        <button 
          onClick={() => {
            console.log("Start button clicked");
            setHasStarted(true);
          }}
          style={{ background: '#FF3B30', color: 'white', border: 'none', padding: '16px 32px', borderRadius: '30px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(255,59,48,0.4)' }}
        >
          {status === 'loading' && hasStarted ? 'Loading...' : 'Start Camera'}
        </button>
      </div>
    );
  }

  return (
    <div className="camera-container">
      <div className="hidden-processor">
        <canvas ref={canvasRef}></canvas>
        <div ref={mapContainerRef} style={{ width: '300px', height: '300px' }}></div>
      </div>

      <div className="status-bar">
        <div className={`status-dot ${status}`}></div>
        {status === 'loading' ? 'Acquiring GPS...' : status === 'error' ? 'Error' : 'GPS Ready'}
      </div>

      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="video-feed" 
      />

      {error && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(255,0,0,0.9)', padding: '20px', borderRadius: '12px', zIndex: 100, textAlign: 'center', width: '80%' }}>
          <AlertCircle size={32} style={{ marginBottom: '10px', color: 'white' }} />
          <p style={{ color: 'white', fontWeight: '500' }}>{error}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '15px', padding: '8px 16px', background: 'white', color: 'red', border: 'none', borderRadius: '20px', fontWeight: 'bold' }}>Try Again</button>
        </div>
      )}

      <div className="overlay-ui">
        <div style={{ flex: 1 }}></div>

        {location && (
          <div className="watermark-preview">
            <div className="watermark-map">
              <MapIcon location={location} />
            </div>
            <div className="watermark-data">
              <div className="watermark-address">{address}</div>
              <div className="watermark-coords">
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </div>
              <div className="watermark-meta">
                <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><MapPin size={10} /> {location.alt ? location.alt.toFixed(1) : 0}m</span>
                {heading !== null && (
                   <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Navigation size={10} /> {heading}° {getDirection(heading)}</span>
                )}
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="camera-controls">
        <button 
          className="shutter-btn" 
          onClick={capturePhoto}
          disabled={!hasPermissions || !location}
        >
          <div className="shutter-btn-inner"></div>
        </button>
      </div>

      <div className={`flash-overlay ${isFlashing ? 'flashing' : ''}`}></div>
    </div>
  );
}

function MapIcon({ location }) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#222', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
       <Mountain size={24} color="#666" />
       <div style={{ position: 'absolute', width: '8px', height: '8px', backgroundColor: '#FF3B30', borderRadius: '50%', border: '1px solid white' }}></div>
    </div>
  )
}
