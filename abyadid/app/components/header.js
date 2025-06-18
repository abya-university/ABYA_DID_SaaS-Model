"use client";

import WalletConnection from "./WallectConnection";


const Header = () => {

    return (
        <>
            <div>
                <header className="bg-gray-800 text-white p-4">
                    <nav className="mt-2 flex flex-row justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <img src="/logo.png" alt="Logo" className="w-8 h-8" />
                            <span className="text-xl font-bold">ABYA DID</span>
                        </div>
                        <ul className="flex space-x-4">
                            <li><a href="/" className="hover:underline">Home</a></li>
                            <li><a href="/about" className="hover:underline">About</a></li>
                            <li><a href="/contact" className="hover:underline">Contact</a></li>
                        </ul>
                        <WalletConnection />
                    </nav>
                </header>
            </div>
        </>
    );
}

export default Header;