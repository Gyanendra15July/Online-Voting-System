document.addEventListener('DOMContentLoaded', async () => {
    const isAdmin = await checkAuth('admin');
    if (!isAdmin) return;
    
    const greeting = document.getElementById('admin-greeting');
    if (greeting) greeting.textContent = `Admin: ${localStorage.getItem('name')}`;
    
    loadElections();
    
    document.getElementById('create-election-form')?.addEventListener('submit', createElection);
    document.getElementById('add-candidate-form')?.addEventListener('submit', addCandidate);
});

let currentAdminChart = null;
let selectedElectionId = null;

const switchTab = (tab) => {
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const link = document.querySelector(`a[href="#${tab}"]`);
    if (link) link.classList.add('active');
    
    ['elections', 'election-detail', 'users', 'audit'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if(el) el.classList.add('hidden');
    });
    
    const target = document.getElementById(`tab-${tab}`);
    if (target) target.classList.remove('hidden');
    
    if (tab === 'elections') loadElections();
    if (tab === 'users') loadUsers();
    if (tab === 'audit') loadAuditLogs();
};

/* --- Elections Management --- */
const loadElections = async () => {
    try {
        const res = await apiCall('/api/admin/elections');
        const tbody = document.querySelector('#admin-elections-table tbody');
        tbody.innerHTML = '';
        
        res.data.forEach(e => {
            tbody.innerHTML += `
                <tr>
                    <td>${e.id}</td>
                    <td>${e.title}</td>
                    <td><span class="badge ${e.status}">${e.status.toUpperCase()}</span></td>
                    <td>${new Date(e.start_time).toLocaleString()}</td>
                    <td>${new Date(e.end_time).toLocaleString()}</td>
                    <td>
                        <button class="btn" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-bottom: 0.25rem;" onclick="viewAdminElection(${e.id})">Manage</button>
                        
                        ${e.status !== 'active' ? `<button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-bottom: 0.25rem; border-color: #10b981; color: #10b981;" onclick="updateElectionStatus(${e.id}, 'start')">Start Vote</button>` : ''}
                        
                        ${e.status === 'active' ? `<button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-bottom: 0.25rem; border-color: #f59e0b; color: #f59e0b;" onclick="updateElectionStatus(${e.id}, 'stop')">Stop Vote</button>` : ''}
                        
                        <button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; border-color: red; color: red;" onclick="deleteElection(${e.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (err) { showAlert(err.message); }
};

const openCreateElectionModal = () => {
    document.getElementById('modal-create-election').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
};

const closeModals = () => {
    document.querySelectorAll('[id^="modal-"]').forEach(m => m.classList.add('hidden'));
};

const createElection = async (e) => {
    e.preventDefault();
    const payload = {
        title: document.getElementById('ce-title').value,
        description: document.getElementById('ce-desc').value,
        start_time: document.getElementById('ce-start').value,
        end_time: document.getElementById('ce-end').value
    };
    try {
        await apiCall('/api/admin/elections', 'POST', payload);
        closeModals();
        showAlert('Election created successfully', 'success');
        loadElections();
    } catch (err) { showAlert(err.message); }
};

const deleteElection = async (id) => {
    console.log(`[Admin UI] DELETE requested for election ID: ${id}`);
    if(!confirm("⚠️ WARNING: This will permanently delete this election and ALL its votes/candidates. Are you sure you want to proceed?")) {
        console.log(`[Admin UI] Delete cancelled for ID: ${id}`);
        return;
    }
    
    try {
        console.log(`[Admin UI] Sending DELETE request for ID: ${id}`);
        const res = await apiCall(`/api/admin/elections/${id}`, 'DELETE');
        console.log(`[Admin UI] Delete response:`, res);
        
        showAlert('Election and all related data deleted successfully', 'success');
        console.log(`[Admin UI] Refreshing elections table...`);
        loadElections();
    } catch (err) { 
        console.error(`[Admin UI] DELETE failed for election ${id}:`, err);
        showAlert(err.message, 'error'); 
    }
};

const updateElectionStatus = async (id, action) => {
    console.log(`[Admin UI] Attempting to ${action} election ID: ${id}`);
    if(!confirm(`Are you sure you want to ${action} this election?`)) {
        console.log(`[Admin UI] User cancelled the ${action} action for ID: ${id}`);
        return;
    }
    
    try {
        const url = `/api/admin/elections/${id}/${action}`;
        console.log(`[Admin UI] Sending PUT request to: ${url}`);
        
        const res = await apiCall(url, 'PUT');
        console.log(`[Admin UI] Server response for ${action}:`, res);
        
        showAlert(`Election ${action === 'start' ? 'started' : 'stopped'} successfully`, 'success');
        console.log(`[Admin UI] UI refreshed, reloading elections list...`);
        loadElections();
    } catch (err) { 
        console.error(`[Admin UI] FAILED to ${action} election ${id}:`, err);
        showAlert(err.message, 'error'); 
    }
};

const viewAdminElection = async (id) => {
    selectedElectionId = id;
    try {
        const data = await apiCall(`/api/vote/elections/${id}`);
        const { election, candidates } = data.data;
        
        switchTab('election-detail');
        document.getElementById('m-elec-title').textContent = election.title;
        
        loadCandidatesTable(candidates);
        await loadAdminResults(id);
        
    } catch (err) { showAlert(err.message); }
};

const loadCandidatesTable = (candidates) => {
    const tbody = document.querySelector('#m-candidates-table tbody');
    tbody.innerHTML = '';
    
    candidates.forEach(c => {
        tbody.innerHTML += `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap: 10px;">
                        <img src="${c.photo_url || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.src='https://placehold.co/40/6366f1/ffffff?text=NA'">
                        ${c.name}
                    </div>
                </td>
                <td>${c.party}</td>
                <td>-</td>
                <td><button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; border-color: red; color: red;" onclick="deleteCandidate(${c.id})">Remove</button></td>
            </tr>
        `;
    });
};

const openAddCandidateModal = () => {
    document.getElementById('modal-add-candidate').classList.remove('hidden');
    document.getElementById('modal-overlay').classList.remove('hidden');
};

const addCandidate = async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('ac-name').value,
        party: document.getElementById('ac-party-name').value,
        party_name: document.getElementById('ac-party-name').value,
        party_logo: document.getElementById('ac-party-logo').value,
        bio: document.getElementById('ac-bio').value,
        photo_url: document.getElementById('ac-photo').value
    };
    try {
        await apiCall(`/api/admin/elections/${selectedElectionId}/candidates`, 'POST', payload);
        closeModals();
        showAlert('Candidate added', 'success');
        document.getElementById('add-candidate-form').reset();
        document.getElementById('upload-preview').innerHTML = '';
        viewAdminElection(selectedElectionId);
    } catch (err) { showAlert(err.message); }
};

// Drag & Drop Handling UI
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('ac-party-logo-file');
        if(!dropZone || !fileInput) return;
        
        dropZone.addEventListener('click', () => fileInput.click());
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.background = 'rgba(99, 102, 241, 0.2)';
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.background = 'transparent';
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.background = 'transparent';
            if(e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                uploadPartyLogo(e.dataTransfer.files[0]);
            }
        });
        
        fileInput.addEventListener('change', (e) => {
            if(e.target.files.length) {
                uploadPartyLogo(e.target.files[0]);
            }
        });
    }, 100);
});

async function uploadPartyLogo(file) {
    if (!file) return;
    document.getElementById('upload-preview').innerHTML = '<span class="text-primary">Uploading...</span>';
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
        const token = localStorage.getItem('token');
        const targetUrl = `/api/upload`;
        
        const res = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const text = await res.text();
        let data;
        try {
             data = JSON.parse(text);
        } catch {
             throw new Error('Server returned invalid JSON on upload.');
        }
        
        if (!res.ok) throw new Error(data.message || 'Upload failed');
        
        document.getElementById('upload-preview').innerHTML = `<img src="${data.url}" style="height: 60px; border-radius: 4px; object-fit: contain;">`;
        document.getElementById('ac-party-logo').value = data.url;
        showAlert('Logo uploaded and compressed securely', 'success');
        
    } catch (err) {
        document.getElementById('upload-preview').innerHTML = '<span class="text-error">Upload failed</span>';
        showAlert(err.message, 'error');
    }
}


const deleteCandidate = async (id) => {
    if(!confirm("Remove candidate?")) return;
    try {
        await apiCall(`/api/admin/candidates/${id}`, 'DELETE');
        showAlert('Candidate removed', 'success');
        viewAdminElection(selectedElectionId);
    } catch (err) { showAlert(err.message); }
};

const loadAdminResults = async (id) => {
    try {
        const data = await apiCall(`/api/admin/elections/${id}/results`);
        const { candidates, totalVotes, turnout } = data.data;
        
        document.getElementById('m-elec-turnout').textContent = `Total Votes: ${totalVotes} | Turnout: ${turnout}%`;
        
        // update candidates table with actual vote counts
        const tbody = document.querySelector('#m-candidates-table tbody');
        const rows = tbody.querySelectorAll('tr');
        candidates.forEach((c, idx) => {
            if(rows[idx]) {
                rows[idx].children[2].textContent = c.vote_count;
            }
        });

        const labels = candidates.map(c => c.name);
        const votes = candidates.map(c => c.vote_count);
        
        const ctx = document.getElementById('adminResultsChart').getContext('2d');
        if (currentAdminChart) currentAdminChart.destroy();
        
        currentAdminChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: votes,
                    backgroundColor: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#fff' } }
                }
            }
        });
        
    } catch (err) { console.error(err); }
};

/* --- Users Management --- */
const loadUsers = async () => {
    try {
        const data = await apiCall('/api/admin/users');
        const tbody = document.querySelector('#users-table tbody');
        tbody.innerHTML = '';
        data.data.forEach(u => {
            tbody.innerHTML += `
                <tr>
                    <td>${u.id}</td>
                    <td>${u.name}</td>
                    <td>${u.email}</td>
                    <td>${u.role}</td>
                    <td>
                        <span class="badge ${u.is_verified ? 'active' : 'upcoming'}">${u.is_verified ? 'Yes' : 'No'}</span>
                        <span class="badge ${u.is_blocked ? 'closed' : 'active'}" style="margin-left:5px;">${u.is_blocked ? 'Blocked' : 'Active'}</span>
                    </td>
                    <td>
                        ${u.role === 'voter' ? 
                            `<button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; border-color: #6366f1; color: #6366f1;" onclick="toggleVerifyUser(${u.id}, ${!u.is_verified})">
                                ${u.is_verified ? 'Revoke Ver.' : 'Verify'}
                            </button>
                             <button class="btn btn-secondary mt-2" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; border-color: red; color: red; display:block;" onclick="toggleBlockUser(${u.id}, ${!u.is_blocked})">
                                ${u.is_blocked ? 'Unblock' : 'Block'}
                            </button>` 
                            : '-'
                        }
                    </td>
                </tr>
            `;
        });
    } catch (err) { showAlert(err.message); }
};

const toggleVerifyUser = async (id, status) => {
    try {
        await apiCall(`/api/admin/users/${id}/verify`, 'PATCH', { is_verified: status });
        showAlert(`User ${status ? 'verified' : 'unverified'}`, 'success');
        loadUsers();
    } catch (err) { showAlert(err.message); }
};

const toggleBlockUser = async (id, status) => {
    try {
        await apiCall(`/api/admin/users/${id}/block`, 'PATCH', { is_blocked: status });
        showAlert(`User ${status ? 'blocked' : 'unblocked'}`, 'success');
        loadUsers();
    } catch (err) { showAlert(err.message); }
};

/* --- Audit Log Management --- */
const loadAuditLogs = async () => {
    try {
        const data = await apiCall('/api/admin/audit-log');
        const tbody = document.querySelector('#audit-table tbody');
        tbody.innerHTML = '';
        data.data.forEach(log => {
            tbody.innerHTML += `
                <tr>
                    <td>${new Date(log.created_at).toLocaleString()}</td>
                    <td>${log.user_name || 'System/Unknown'} (ID: ${log.user_id || 'N/A'})</td>
                    <td><span class="badge" style="background: rgba(255,255,255,0.1);">${log.action}</span></td>
                    <td>${log.details}</td>
                    <td>${log.ip_address}</td>
                </tr>
            `;
        });
    } catch (err) { showAlert(err.message); }
};

// Also fix some backend api logic implicitly - admin get elections should work, using /api/vote/elections which is already unprotected by specific role (voters and admin can use it).
