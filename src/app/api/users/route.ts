import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import serviceAccountData from '../../../../serviceAccountKey.json';

// Initialize Firebase Admin if not already
if (!admin.apps.length) {
  try {
    // Assert the type to any to avoid TypeScript complaints if needed, 
    // though Next.js resolveJsonModule usually handles it perfectly.
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountData as any)
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, name, role, department } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1. Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: name,
    });

    // 2. Add user profile to Firestore
    const db = admin.firestore();
    await db.collection('users').doc(userRecord.uid).set({
      email,
      name,
      role,
      department: department || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json(
      { message: 'User created successfully', uid: userRecord.uid },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
