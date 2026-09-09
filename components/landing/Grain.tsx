'use client';

// Animated film-grain overlay — makes flat dark backgrounds feel premium/organic.
// The grain tile shifts position every frame (steps(1)) simulating real film grain.
export default function Grain() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes grain-shift {
          0%  { transform: translate(0,   0); }
          10% { transform: translate(-5%, -10%); }
          20% { transform: translate(4%,  -3%); }
          30% { transform: translate(-3%,  8%); }
          40% { transform: translate(7%,  -6%); }
          50% { transform: translate(-6%,  3%); }
          60% { transform: translate(3%,   7%); }
          70% { transform: translate(-8%, -4%); }
          80% { transform: translate(5%,  -8%); }
          90% { transform: translate(-2%,  5%); }
          100%{ transform: translate(0,   0); }
        }
        .spark-grain {
          position: fixed;
          inset: -100%;
          width: 300%;
          height: 300%;
          z-index: 9999;
          pointer-events: none;
          opacity: 0.038;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)'/%3E%3C/svg%3E");
          background-repeat: repeat;
          background-size: 300px 300px;
          animation: grain-shift 0.35s steps(1) infinite;
        }
      `}} />
      <div className="spark-grain" aria-hidden="true" />
    </>
  );
}
