

// Elementos del DOM
const deviceForm = document.getElementById('deviceForm');
const devicesTableBody = document.getElementById('devicesTableBody');
const historyTableBody = document.getElementById('historyTableBody');
const statusFilter = document.getElementById('statusFilter');
const exportBtn = document.getElementById('exportBtn');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const notification = document.getElementById('notification');
const devicesInsideElement = document.getElementById('devicesInside');
const devicesOutsideElement = document.getElementById('devicesOutside');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    updateDevicesTable();
    updateHistoryTable();
    updateStats();
    
    // Configurar eventos
    deviceForm.addEventListener('submit', handleFormSubmit);
    statusFilter.addEventListener('change', updateDevicesTable);
    exportBtn.addEventListener('click', exportToCSV);
    
    // Configurar pestañas
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    // Manejar cambio en el tipo de dispositivo
    document.getElementById('deviceType').addEventListener('change', function() {
        const otherDeviceGroup = document.getElementById('otherDeviceGroup');
        if (this.value === 'Otros') {
            otherDeviceGroup.style.display = 'block';
            document.getElementById('deviceName').required = true;
        } else {
            otherDeviceGroup.style.display = 'none';
            document.getElementById('deviceName').required = false;
            document.getElementById('deviceName').value = '';
        }
    });
});

async function getDevices() {
    return await apiCall('/devices');
}

async function addDevice(deviceData) {
    return await apiCall('/devices', {
        method: 'POST',
        body: JSON.stringify(deviceData)
    });
}

async function updateDevice(id, updates) {
    return await apiCall(`/devices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
    });
}

async function deleteDevice(id) {
    return await apiCall(`/devices/${id}`, {
        method: 'DELETE'
    });
}

async function getStats() {
    return await apiCall('/stats');
}

// Funciones principales
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const deviceType = document.getElementById('deviceType').value;
    const deviceName = document.getElementById('deviceName').value;
    const deviceBrand = document.getElementById('deviceBrand').value;
    const serialNumber = document.getElementById('serialNumber').value;
    const responsible = document.getElementById('responsible').value;
    const reason = document.getElementById('reason').value;
    const movementType = document.getElementById('movementType').value;
    
    // Validar campos requeridos
    if (!deviceType || !deviceBrand || !serialNumber || !responsible || !reason || !movementType) {
        showNotification('Por favor, complete todos los campos', 'error');
        return;
    }
    
    // Validar que si se selecciona "Otros", se especifique el nombre
    if (deviceType === 'Otros' && !deviceName) {
        showNotification('Por favor, especifique el tipo de dispositivo', 'error');
        return;
    }
    
    // Determinar el nombre final del dispositivo
    const finalDeviceName = deviceType === 'Otros' ? deviceName : deviceType;
    
    try {
        await addDevice({
            name: finalDeviceName,
            brand: deviceBrand,
            serialNumber: serialNumber,
            responsible: responsible,
            reason: reason,
            movementType: movementType
        });
        
        updateDevicesTable();
        updateHistoryTable();
        updateStats();
        deviceForm.reset();
        document.getElementById('otherDeviceGroup').style.display = 'none';
        
        showNotification('Dispositivo registrado correctamente', 'success');
    } catch (error) {
        showNotification('Error al registrar el dispositivo', 'error');
    }
}

async function updateDevicesTable() {
    try {
        const devices = await getDevices();
        const filterValue = statusFilter.value;
        
        let filteredDevices = devices;
        
        if (filterValue !== 'todos') {
            filteredDevices = devices.filter(device => device.status === filterValue);
        }
        
        devicesTableBody.innerHTML = '';
        
        if (filteredDevices.length === 0) {
            devicesTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No hay dispositivos registrados</td></tr>';
            return;
        }
        
        filteredDevices.forEach(device => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${device.name}</td>
                <td>${device.brand}</td>
                <td>${device.serialNumber}</td>
                <td>${device.responsible}</td>
                <td>${device.reason}</td>
                <td>${device.timestamp}</td>
                <td><span class="status status-${device.status}">${device.status.charAt(0).toUpperCase() + device.status.slice(1)}</span></td>
                <td>
                    <div class="actions">
                        ${device.status === 'pendiente' ? 
                            `<button class="success" onclick="validateDevice(${device.id})">Validar</button>` : 
                            device.status === 'validado' && device.movementType === 'salida' ?
                            `<button class="warning" onclick="markAsDelivered(${device.id})">Marcar Salida</button>` :
                            ''
                        }
                        <button class="danger" onclick="deleteDeviceHandler(${device.id})">Eliminar</button>
                    </div>
                </td>
            `;
            devicesTableBody.appendChild(row);
        });
    } catch (error) {
        devicesTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: red;">Error al cargar los dispositivos</td></tr>';
    }
}

async function updateHistoryTable() {
    try {
        const devices = await getDevices();
        historyTableBody.innerHTML = '';
        
        if (devices.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No hay historial disponible</td></tr>';
            return;
        }
        
        // Ordenar por fecha (más reciente primero)
        const sortedDevices = [...devices].sort((a, b) => 
            new Date(b.timestamp.split('/').reverse().join('-')) - new Date(a.timestamp.split('/').reverse().join('-'))
        );
        
        sortedDevices.forEach(device => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${device.name}</td>
                <td>${device.brand}</td>
                <td>${device.serialNumber}</td>
                <td>${device.responsible}</td>
                <td>${device.reason}</td>
                <td>${device.timestamp}</td>
                <td><span class="status status-${device.status}">${device.status.charAt(0).toUpperCase() + device.status.slice(1)}</span></td>
                <td>${device.movementType === 'entrada' ? 'Entrada' : 'Salida'}</td>
            `;
            historyTableBody.appendChild(row);
        });
    } catch (error) {
        historyTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: red;">Error al cargar el historial</td></tr>';
    }
}

async function updateStats() {
    try {
        const stats = await getStats();
        devicesInsideElement.textContent = stats.inside;
        devicesOutsideElement.textContent = stats.outside;
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// Funciones de acciones
async function validateDevice(id) {
    try {
        await updateDevice(id, { status: 'validado' });
        updateDevicesTable();
        updateHistoryTable();
        updateStats();
        showNotification('Dispositivo validado correctamente', 'success');
    } catch (error) {
        showNotification('Error al validar el dispositivo', 'error');
    }
}

async function markAsDelivered(id) {
    try {
        await updateDevice(id, { status: 'entregado' });
        updateDevicesTable();
        updateHistoryTable();
        updateStats();
        showNotification('Dispositivo marcado como entregado', 'success');
    } catch (error) {
        showNotification('Error al marcar como entregado', 'error');
    }
}

async function deleteDeviceHandler(id) {
    if (confirm('¿Está seguro de que desea eliminar este dispositivo?')) {
        try {
            await deleteDevice(id);
            updateDevicesTable();
            updateHistoryTable();
            updateStats();
            showNotification('Dispositivo eliminado correctamente', 'success');
        } catch (error) {
            showNotification('Error al eliminar el dispositivo', 'error');
        }
    }
}

// Funciones de utilidad
function switchTab(tabId) {
    // Desactivar todas las pestañas
    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Activar la pestaña seleccionada
    document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(`${tabId}-tab`).classList.add('active');
    
    // Actualizar tablas si es necesario
    if (tabId === 'list') {
        updateDevicesTable();
    } else if (tabId === 'history') {
        updateHistoryTable();
    }
}

function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function exportToCSV() {
    // Redirigir al endpoint de exportación
    window.location.href = `${API_BASE}/export/csv`;
}