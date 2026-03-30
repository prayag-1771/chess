import Link from "next/link"
import Image from "next/image"

export default function Home() {
  return (
    <div className="h-screen bg-[#302e2b]">
      <div className="pt-16 flex justify-center">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="ml-4 flex justify-center">
            <div className="max-w-lg">
              <Image src="/chessboard.png" alt="Chess board" width={500} height={500} />
            </div>
          </div>
          <div className="ml-24 pt-16">
            <div className="flex justify-center">
              <h1 className="text-4xl font-bold text-white">Play Chess on the #1 Site!</h1>
            </div>
            <div className="flex justify-center pt-10">
              <Link href="/game" className="bg-[#81b64c] font-bold text-lg text-white px-10 py-2 rounded-md">
                Play Online
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
