"use client";

const Homepage = () => {
    return (
        <>
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
                <h1 className="text-4xl font-bold mb-4 text-gray-600">Welcome to My App</h1>
                <p className="text-lg mb-8 text-gray-400">This is a simple Next.js application.</p>
                <a
                    href="https://nextjs.org/docs"
                    className="text-blue-500 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Learn more about Next.js
                </a>
                <div className="mt-8">
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="w-32 h-32 rounded-full shadow-lg"
                    />
                </div>
                <div className="mt-8">
                    <p className="text-gray-600">Made with ❤️ by Your Name</p>
                </div>
                <footer className="mt-12 text-sm text-gray-500">
                    © 2023 Your Company
                </footer>
            </div>
        </>
    );
}

export default Homepage;