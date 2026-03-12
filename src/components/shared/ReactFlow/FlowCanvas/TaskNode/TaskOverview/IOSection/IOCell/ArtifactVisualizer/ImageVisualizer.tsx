interface ImageVisualizerProps {
  src: string;
  name: string;
}

const ImageVisualizer = ({ src, name }: ImageVisualizerProps) => (
  <img src={src} alt={name} className="h-full rounded-md object-contain" />
);

export default ImageVisualizer;
