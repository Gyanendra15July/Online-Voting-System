// Using native fetch in Node 24

async function testRegistration() {
    const payload = {
        name: "Prod Tester",
        email: `prodtest${Date.now()}@gmail.com`,
        password: "password123",
        role: "voter",
        voter_id: `VID_PROD_${Date.now()}`,
        device_id: `DEVICE_CLI_TEST_${Date.now()}`,
        face_data: "test_face_signature_prod"
    };

    try {
        console.log('Sending Registration to Render...');
        const res = await fetch('https://online-voting-system-8sr7.onrender.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Response:', data);
    } catch (err) {
        console.error('Test Failed:', err.message);
    }
}

testRegistration();
