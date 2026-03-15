import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin if not already
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase Admin environment variables');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
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
