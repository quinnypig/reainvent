import Marketplace from "./marketplace";
import ManagedAuth from "./managed-auth";
export default function Home() {
  return (
    <ManagedAuth>
      <Marketplace />
    </ManagedAuth>
  );
}
