
import React from 'react';

const Spinner: React.FC = () => {
    return (
        <div className="flex justify-center items-center h-full w-full">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#00ddeb]"></div>
        </div>
    );
};

export default Spinner;
