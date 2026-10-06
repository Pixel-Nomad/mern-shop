const App = () => {
  return (
    <main className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-xl text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          MERN Shop
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Production-grade e-commerce platform. Coming soon.
        </p>
        <button className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors">
          Get Started
        </button>
      </div>
    </main>
  );
};

export default App;