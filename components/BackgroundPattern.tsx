export default function BackgroundPattern() {
  return (
    <div className="fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: "50px 50px",
        }}
      />
    </div>
  );
}

