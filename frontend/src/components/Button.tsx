import type React from "react"

export const Button = ({ onClick, children }: { onClick: () => void, children: React.ReactNode}) => {
  return <button className='col-span-2 bg-[#739552] py-2 px-5 rounded-md' onClick={onClick}>
    { children }
  </button>
}