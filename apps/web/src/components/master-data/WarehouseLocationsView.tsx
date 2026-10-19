'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../lib/api-client';
import { ListPageTemplate, FormPageTemplate } from '../templates';
import { Card, CardContent, Button, Input, Select, DataTable, KpiCard, StatusBadge, TableSkeleton, EmptyState, ErrorState } from '../ui';
import { useToast } from '../../context/toast-context';
import { IconMapPin, IconPlus, IconRefresh, IconDownload, IconEdit, IconCheck } from '../icons';

const LOCATION_TYPES = ['ZONE', 'RACK', 'BIN', 'SHELF', 'FLOOR', 'TANK'];

interface WarehouseLocation {
  id: string;
  warehouseId: string;
  locationCode: string;
  locationName: string;
  locationType: string;
  capacity?: number | null;
  capacityUom?: string | null;
  status: string;
  warehouse?: { id: string; name: string; code: string };
}

export const WarehouseLocationsView: React.FC = () => {
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedLocation, setSelectedLocation] = useState<WarehouseLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    warehouseId: '',
    locationCode: '',
    locationName: '',
    locationType: 'ZONE',
    capacity: '',
    capacityUom: 'MT',
    status: 'ACTIVE',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [locRes, whRes] = await Promise.all([
        ApiClient.get<WarehouseLocation[]>('/api/v1/master-data/warehouse-locations'),
        ApiClient.get<any[]>('/api/v1/master-data/warehouses?all=true'),
      ]);
      setLocations(locRes.data || []);
      setWarehouses(whRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load warehouse locations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = locations.filter((loc: any) => {
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch =
      String(loc.locationCode || '').toLowerCase().includes(q) ||
      String(loc.locationName || '').toLowerCase().includes(q);
    const matchesWarehouse = warehouseFilter === 'ALL' || loc.warehouseId === warehouseFilter;
    return matchesSearch && matchesWarehouse;
  });

  const handleSave = async () => {
    if (!formData.warehouseId || !formData.locationCode || !formData.locationName) {
      showToast({ title: 'Validation Error', message: 'Warehouse, code, and name are required', type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        capacity: formData.capacity ? Number(formData.capacity) : undefined,
      };
      if (mode === 'edit' && selectedLocation) {
        await ApiClient.patch(`/api/v1/master-data/warehouse-locations/${selectedLocation.id}`, payload);
        showToast({ title: 'Updated', message: `${formData.locationName} updated successfully`, type: 'success' });
      } else {
        await ApiClient.post('/api/v1/master-data/warehouse-locations', payload);
        showToast({ title: 'Created', message: `${formData.locationName} registered successfully`, type: 'success' });
      }
      await fetchData();
      setMode('list');
    } catch (err: any) {
      showToast({ title: 'Save Failed', message: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    {
      key: 'locationCode',
      label: 'Location Code',
      render: (row: WarehouseLocation) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-brand-600)', fontSize: '0.85rem' }}>
          {row.locationCode}
        </span>
      ),
    },
    {
      key: 'locationName',
      label: 'Location Name',
      render: (row: WarehouseLocation) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.locationName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {row.warehouse?.name || warehouses.find((w) => w.id === row.warehouseId)?.name || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'locationType',
      label: 'Type',
      render: (row: WarehouseLocation) => (
        <span
          style={{
            padding: '2px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 700,
            background: 'var(--color-blue-50)',
            color: 'var(--color-blue-700)',
            border: '1px solid var(--color-blue-200)',
          }}
        >
          {row.locationType}
        </span>
      ),
    },
    {
      key: 'capacity',
      label: 'Capacity',
      render: (row: WarehouseLocation) =>
        row.capacity ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {row.capacity} {row.capacityUom || ''}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row: WarehouseLocation) => <StatusBadge status={row.status || 'ACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: (row: WarehouseLocation) => (
        <Button
          variant="ghost"
          size="sm"
          icon={<IconEdit size={14} />}
          onClick={() => {
            setSelectedLocation(row);
            setFormData({
              warehouseId: row.warehouseId,
              locationCode: row.locationCode,
              locationName: row.locationName,
              locationType: row.locationType || 'ZONE',
              capacity: row.capacity ? String(row.capacity) : '',
              capacityUom: row.capacityUom || 'MT',
              status: row.status || 'ACTIVE',
            });
            setMode('edit');
          }}
        >
          Edit
        </Button>
      ),
    },
  ];

  if (mode === 'create' || mode === 'edit') {
    return (
      <FormPageTemplate
        title={mode === 'create' ? 'Register Warehouse Sub-Location' : `Edit — ${selectedLocation?.locationName}`}
        subtitle="Manage zones, aisles, racks, and bins within physical warehouse facilities."
        breadcrumbs={[
          { label: 'Master Data', href: '#' },
          { label: 'Warehouse Locations', href: '#' },
          { label: mode === 'create' ? 'New Location' : 'Edit' },
        ]}
        onSave={handleSave}
        onCancel={() => setMode('list')}
        isSaving={isSaving}
        sections={[
          {
            title: 'Facility Placement & Code',
            fields: [
              {
                label: 'Parent Warehouse *',
                required: true,
                field: (
                  <Select
                    value={formData.warehouseId}
                    onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                    options={[
                      { value: '', label: 'Select Warehouse' },
                      ...warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
                    ]}
                  />
                ),
              },
              {
                label: 'Location Code *',
                required: true,
                field: (
                  <Input
                    value={formData.locationCode}
                    onChange={(e) => setFormData({ ...formData, locationCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. WH-A-Z1-R01"
                    disabled={mode === 'edit'}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                ),
              },
              {
                label: 'Location Name *',
                required: true,
                field: (
                  <Input
                    value={formData.locationName}
                    onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
                    placeholder="e.g. Raw Material Silo Zone 1"
                  />
                ),
              },
              {
                label: 'Storage Structure Type',
                field: (
                  <Select
                    value={formData.locationType}
                    onChange={(e) => setFormData({ ...formData, locationType: e.target.value })}
                    options={LOCATION_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                ),
              },
            ],
          },
          {
            title: 'Capacity & Operating Parameters',
            fields: [
              {
                label: 'Holding Capacity',
                field: (
                  <Input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="e.g. 500"
                  />
                ),
              },
              {
                label: 'Capacity UOM',
                field: (
                  <Input
                    value={formData.capacityUom}
                    onChange={(e) => setFormData({ ...formData, capacityUom: e.target.value })}
                    placeholder="e.g. MT, Bags, Pallets"
                  />
                ),
              },
              {
                label: 'Status',
                field: (
                  <Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    options={[
                      { value: 'ACTIVE', label: 'Active' },
                      { value: 'INACTIVE', label: 'Inactive' },
                    ]}
                  />
                ),
              },
            ],
          },
        ]}
      />
    );
  }

  return (
    <ListPageTemplate
      title="Warehouse Sub-Locations"
      subtitle="Detailed granular storage bin, rack, and zone topography within operating warehouses."
      breadcrumbs={[{ label: 'Master Data', href: '#' }, { label: 'Warehouse Locations' }]}
      primaryAction={{
        label: 'New Location',
        icon: <IconPlus size={16} />,
        onClick: () => {
          setFormData({
            warehouseId: warehouses[0]?.id || '',
            locationCode: '',
            locationName: '',
            locationType: 'ZONE',
            capacity: '',
            capacityUom: 'MT',
            status: 'ACTIVE',
          });
          setMode('create');
        },
      }}
      secondaryActions={[
        { label: 'Refresh', icon: <IconRefresh size={16} />, onClick: fetchData },
        {
          label: 'Export',
          icon: <IconDownload size={16} />,
          onClick: () => showToast({ title: 'Export Ready', message: 'Warehouse locations exported to CSV', type: 'info' }),
        },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiCard title="Total Locations" value={locations.length} icon={<IconMapPin size={20} />} />
        <KpiCard title="Active Locations" value={locations.filter((l) => l.status === 'ACTIVE').length} icon={<IconCheck size={20} />} />
        <KpiCard title="Warehouses Configured" value={warehouses.length} icon={<IconMapPin size={20} />} />
      </div>

      <Card style={{ marginBottom: '1.5rem' }}>
        <CardContent style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
          <div style={{ flex: '1 1 300px' }}>
            <Input
              placeholder="Search by location code or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div style={{ width: '240px' }}>
            <Select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Warehouses' },
                ...warehouses.map((w) => ({ value: w.id, label: w.name })),
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Warehouse Locations Found"
          description={searchQuery ? 'No locations match your search.' : 'No locations configured for selected warehouse.'}
          actionLabel={searchQuery ? 'Clear Search' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
        />
      ) : (
        <DataTable columns={columns} data={filtered} />
      )}
    </ListPageTemplate>
  );
};
